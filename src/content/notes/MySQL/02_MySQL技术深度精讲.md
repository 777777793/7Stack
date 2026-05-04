# MySQL 技术深度精讲

> 面向 Java 开发者的 MySQL 内核知识体系，覆盖面试高频考点与生产排障实战。

---

## 1. 架构总览

### 1.1 MySQL 整体架构

MySQL 采用经典的**分层架构**，从上到下可以划分为三层：

```
┌─────────────────────────────────────────────────────────┐
│                     客户端层                              │
│   (JDBC / MySQL CLI / Navicat / 各种驱动)                │
└──────────────────────┬──────────────────────────────────┘
                       │ TCP/Socket 连接
┌──────────────────────▼──────────────────────────────────┐
│                   Server 层                               │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ 连接管理器│→│ 查询缓存  │→│  解析器   │→│ 预处理器 │ │
│  │Connection │  │Query Cache│  │ Parser   │  │Preproces│ │
│  │ Manager  │  │(8.0已移除)│  │          │  │  sor    │ │
│  └──────────┘  └──────────┘  └──────────┘  └────┬────┘ │
│                                                   │      │
│                              ┌──────────┐  ┌─────▼────┐ │
│                              │ 执行器    │←│ 优化器   │ │
│                              │ Executor │  │ Optimizer│ │
│                              └─────┬────┘  └─────────┘  │
└────────────────────────────────────┼────────────────────┘
                                     │ 调用存储引擎接口
┌────────────────────────────────────▼────────────────────┐
│                   存储引擎层                              │
│                                                           │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  │
│   │ InnoDB  │  │ MyISAM  │  │ Memory  │  │ Archive  │  │
│   │(默认)   │  │         │  │         │  │          │  │
│   └─────────┘  └─────────┘  └─────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 1.2 餐厅类比理解架构

把 MySQL 想象成一家餐厅：

| 餐厅角色 | MySQL 组件 | 职责 |
|---------|-----------|------|
| 前台接待 | 连接管理器 | 验证身份（账号密码），分配座位（线程） |
| 菜单上的"推荐菜" | 查询缓存 | 上次点过同样的菜？直接端上来（8.0后撤掉了） |
| 服务员记录点单 | 解析器 | 把你说的话翻译成标准菜单格式（SQL → AST） |
| 厨师长排单 | 优化器 | 决定先炒哪个菜、用什么锅最快（执行计划） |
| 传菜员 | 执行器 | 按厨师长安排去厨房取菜（调用存储引擎） |
| 后厨 | InnoDB 引擎 | 真正做菜的地方（数据存取） |

### 1.3 一条 SQL 查询的完整旅程

以 `SELECT * FROM users WHERE id = 1` 为例：

```
步骤 1: 客户端通过 TCP 三次握手连接 MySQL，连接管理器验证用户名密码
         ↓
步骤 2: （MySQL 5.7）检查查询缓存，命中则直接返回
         ↓（未命中或 8.0+）
步骤 3: 解析器进行词法分析 + 语法分析，生成抽象语法树（AST）
         - 词法分析: 识别 SELECT、FROM、WHERE 等关键字
         - 语法分析: 检查 SQL 语法是否正确
         ↓
步骤 4: 预处理器检查表和列是否存在，解析通配符 *
         ↓
步骤 5: 优化器生成执行计划
         - 判断: id 列有主键索引 → 走主键索引查找
         - 如果有多个索引可选，基于成本模型选择最优
         ↓
步骤 6: 执行器检查权限，然后调用 InnoDB 存储引擎接口
         ↓
步骤 7: InnoDB 先查 Buffer Pool，命中则直接返回
         ↓（未命中）
步骤 8: 从磁盘加载对应的数据页（16KB）到 Buffer Pool
         ↓
步骤 9: 返回结果集给客户端
```

**Java 连接示例：**

```java
// JDBC 连接就是上面步骤1的具体实现
try (Connection conn = DriverManager.getConnection(
        "jdbc:mysql://localhost:3306/mydb?useSSL=false", "root", "password");
     PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE id = ?")) {
    ps.setInt(1, 1);  // 参数绑定，防止 SQL 注入
    ResultSet rs = ps.executeQuery();  // 步骤2-9 全部在这一行触发
    while (rs.next()) {
        System.out.println(rs.getString("name"));
    }
}
```

> **一句话记忆：** 一条 SQL 要经过"连接 → 缓存 → 解析 → 优化 → 执行 → 引擎"六站，Server 层负责"怎么做"，引擎层负责"做出来"。

---

## 2. InnoDB 存储引擎核心

### 2.1 为什么 InnoDB 是默认引擎

从 MySQL 5.5 开始，InnoDB 取代 MyISAM 成为默认引擎。下表说明原因：

| 特性 | InnoDB | MyISAM |
|------|--------|--------|
| 事务支持 | 支持 ACID | 不支持 |
| 行级锁 | 支持 | 只有表级锁 |
| 外键 | 支持 | 不支持 |
| 崩溃恢复 | 自动恢复（redo log） | 需要手动修复 |
| MVCC | 支持 | 不支持 |
| 全文索引 | 5.6+ 支持 | 支持 |
| 存储限制 | 64TB | 256TB |
| 缓存机制 | Buffer Pool 缓存数据+索引 | 只缓存索引（Key Cache） |
| COUNT(*) | 需要遍历（MVCC导致不同事务看到不同行数） | 直接存储行数 |
| 适用场景 | OLTP（高并发读写） | 只读或读多写少（如日志表） |

> **一句话记忆：** 生产环境无脑选 InnoDB，除非你的表永远只读且不需要事务。

### 2.2 B+ 树结构详解

#### 图书馆类比

把 B+ 树想象成一个**图书馆的索引系统**：

- **根节点** = 图书馆入口的总目录牌："A-M 去左边，N-Z 去右边"
- **内部节点** = 各楼层的分类指示牌："计算机类在301-320书架"
- **叶子节点** = 真正的书架，书按顺序排列，书架之间有通道相连

关键特征：**数据只在叶子节点，叶子节点之间通过双向链表相连**。

```
                        ┌───────────┐
                        │  根节点    │
                        │ [30 | 60] │
                        └─┬───┬───┬─┘
                ┌─────────┘   │   └──────────┐
                ▼             ▼              ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ [10 | 20]│  │ [40 | 50]│  │ [70 | 80]│  ← 内部节点
         └─┬──┬──┬──┘  └─┬──┬──┬──┘  └─┬──┬──┬──┘
           ▼  ▼  ▼      ▼  ▼  ▼      ▼  ▼  ▼
    叶子节点层（存储真实数据行，双向链表连接）:

    ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐
    │1-10 │⇄ │11-20│⇄ │21-30│⇄ │31-40│⇄ │41-50│ ...
    │data │   │data │   │data │   │data │   │data │
    └─────┘   └─────┘   └─────┘   └─────┘   └─────┘
```

#### 为什么用 B+ 树而不用 B 树或红黑树

| 对比维度 | B+ 树 | B 树 | 红黑树 |
|---------|-------|------|--------|
| 数据位置 | 只在叶子节点 | 每个节点都有 | 每个节点都有 |
| 叶子链表 | 有（范围查询快） | 没有 | 没有 |
| 树高度 | 极低（3-4层存千万数据） | 较低 | 很高 |
| 磁盘IO | 极少 | 较少 | 很多 |
| 范围查询 | 沿链表扫描，极快 | 需要中序遍历 | 需要中序遍历 |

> 一棵高度为 3 的 B+ 树，假设每页存 1000 个指针，可存 1000 x 1000 x 行数/页 ≈ **上千万行数据，只需 3 次磁盘 IO**。

> **一句话记忆：** B+ 树的精髓在于"矮胖"（低树高减少 IO）和"有序链表"（范围查询高效）。

### 2.3 聚簇索引 vs 二级索引

```
聚簇索引（主键索引）：叶子节点存储 完整数据行

主键B+树:
    [根: 30]
   /        \
  [10,20]   [40,50]
  /  |  \    /  |  \
 ┌────┐┌────┐┌────┐┌────┐┌────┐
 │id=1││id=2││id=3││id=4││id=5│  ← 完整行数据
 │name││name││name││name││name│
 │age ││age ││age ││age ││age │
 └────┘└────┘└────┘└────┘└────┘


二级索引（非主键索引）：叶子节点存储 主键值

以 name 列建索引:
    [根: "李"]
   /          \
  ["陈","黄"] ["王","张"]
  /  |  \      /  |  \
 ┌──────┐ ┌──────┐ ┌──────┐
 │陈→id=3│ │黄→id=1│ │李→id=5│  ← 存的是主键id
 └──────┘ └──────┘ └──────┘


回表过程:
  SELECT * FROM users WHERE name = '张三'

  步骤1: 在 name 索引树上找到 '张三' → 得到 id=4
  步骤2: 拿着 id=4 回到主键索引树查找完整行  ← 这就是"回表"
```

**为什么二级索引不直接存行地址而存主键值？**

因为数据页分裂、合并时物理位置会变，如果二级索引存的是物理地址，每次页分裂都要更新所有相关的二级索引，代价极高。存主键值虽然多一次回表查找，但避免了大量维护开销。

> **一句话记忆：** 聚簇索引"索引即数据"，二级索引需要"回表"拿完整行，回表是性能优化的重点。

### 2.4 数据页结构

InnoDB 中数据存储的基本单位是**页（Page）**，默认大小 **16KB**。

```
┌────────────────────────────────────────────┐
│              Page Header (56B)             │ ← 页号、上/下页指针、页类型等
├────────────────────────────────────────────┤
│           Infimum + Supremum               │ ← 虚拟的最小和最大记录
├────────────────────────────────────────────┤
│                                            │
│            User Records                    │ ← 真正的数据行（从低地址往高长）
│            ↓ 数据向下增长                    │
│                                            │
│            ↑ 空闲空间向上缩小                │
│            Free Space                      │
│                                            │
├────────────────────────────────────────────┤
│          Page Directory                    │ ← 页内的"稀疏索引"，加速页内查找
├────────────────────────────────────────────┤
│           File Trailer (8B)                │ ← 校验和，保证页完整写入
└────────────────────────────────────────────┘
```

**页分裂（Page Split）**：

当一页数据满了，再插入新数据时：
1. 分配一个新页
2. 把原页约 50% 的数据移到新页
3. 调整上下页指针

页分裂是**昂贵操作**，这就是为什么建议使用**自增主键**：顺序写入几乎不会触发页分裂。

而 UUID 作为主键则会造成随机插入，频繁触发页分裂，性能下降明显。

> **一句话记忆：** InnoDB 以 16KB 的页为最小 IO 单位，自增主键能避免页分裂，这是使用自增 ID 的核心原因。

### 2.5 Buffer Pool 内存管理

Buffer Pool 是 InnoDB 最重要的内存结构，**缓存热点数据页，减少磁盘 IO**。

```
Buffer Pool 内存结构:

┌─────────────────────────────────────────────────┐
│                 Buffer Pool                      │
│                                                  │
│  ┌──────────── LRU List ────────────────────┐   │
│  │                                           │   │
│  │  ┌─── young 区(热数据) ───┐ ┌── old 区 ──┐│   │
│  │  │ Page Page Page ...    │ │ Page Page  ││   │
│  │  │ ← 频繁访问的页在此    │ │ ← 新加载的 ││   │
│  │  └──────────────────────┘ │   页在此    ││   │
│  │                           └─────────────┘│   │
│  │  ←── 5/8 ──→              ←── 3/8 ──→   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌── Free List ──┐  ┌── Flush List ──┐          │
│  │ 空闲页         │  │ 脏页（待写回磁盘）│          │
│  └───────────────┘  └────────────────┘          │
└─────────────────────────────────────────────────┘
```

**改进的 LRU 算法**：

MySQL 没有使用朴素 LRU，而是将链表分为 **young 区（热端）** 和 **old 区（冷端）**，比例约 5:8 和 3:8。

为什么？防止**全表扫描污染**。如果一个大表全表扫描，加载的大量页只用一次就不再访问，朴素 LRU 会把真正的热数据都挤掉。

改进策略：
1. 新页先放到 old 区头部
2. 在 old 区存活超过 `innodb_old_blocks_time`（默认 1000ms）后再次被访问，才提升到 young 区
3. 全表扫描的页因为短时间内不会被再次访问，自然从 old 区淘汰

**核心参数**：

```sql
-- 查看 Buffer Pool 大小（生产建议设为物理内存的 60%-80%）
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';

-- 查看 Buffer Pool 命中率（应保持 > 99%）
SHOW STATUS LIKE 'Innodb_buffer_pool_read%';
-- 命中率 = 1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)
```

> **一句话记忆：** Buffer Pool 是 InnoDB 性能的命脉，改进 LRU 分冷热区防全表扫描污染，生产上它的命中率必须 > 99%。

---

## 3. 索引深度剖析

### 3.1 索引类型总览

| 索引类型 | 数据结构 | 适用场景 | 说明 |
|---------|---------|---------|------|
| B+ 树索引 | B+ Tree | 等值查询、范围查询、排序 | 最常用，默认类型 |
| Hash 索引 | Hash 表 | 等值查询 | Memory 引擎支持，InnoDB 有自适应 Hash |
| 全文索引 | 倒排索引 | 文本搜索 | InnoDB 5.6+ 支持，生产中通常用 ES |

**InnoDB 自适应 Hash 索引**：InnoDB 会自动监控索引页的访问模式，对频繁访问的页在内部建立 Hash 索引，无需手动创建。这是引擎层面的透明优化。

> **一句话记忆：** 99% 的场景用 B+ 树索引，Hash 索引只对等值查询有效且不支持范围查询。

### 3.2 联合索引与最左前缀原则

**联合索引** `INDEX(a, b, c)` 在 B+ 树中的排列方式：

```
联合索引 (a, b, c) 的 B+ 树叶子节点排列:

先按 a 排序，a 相同按 b 排序，b 相同按 c 排序

┌──────────┬──────────┬──────────┬──────────┬──────────┐
│a=1,b=1,c=1│a=1,b=1,c=3│a=1,b=2,c=1│a=2,b=1,c=1│a=2,b=3,c=2│
└──────────┴──────────┴──────────┴──────────┴──────────┘
  ← 整体按 (a, b, c) 有序 →

注意观察: a 列全局有序
          b 列在 a 相同时才有序
          c 列在 a,b 都相同时才有序
```

**最左前缀匹配规则**（以 INDEX(a, b, c) 为例）：

| 查询条件 | 能否使用索引 | 说明 |
|---------|-----------|------|
| `WHERE a = 1` | 能，用到 a | 最左列匹配 |
| `WHERE a = 1 AND b = 2` | 能，用到 a, b | 前两列匹配 |
| `WHERE a = 1 AND b = 2 AND c = 3` | 能，用到 a, b, c | 全部匹配 |
| `WHERE b = 2` | 不能 | 缺少最左列 a |
| `WHERE b = 2 AND c = 3` | 不能 | 缺少最左列 a |
| `WHERE a = 1 AND c = 3` | 能，但只用到 a | b 断了，c 无法用索引 |
| `WHERE a > 1 AND b = 2` | 能，但只用到 a | a 是范围查询，b 无法用 |
| `WHERE a = 1 AND b > 2 AND c = 3` | 能，用到 a, b | b 是范围，c 无法用 |
| `WHERE a = 1 ORDER BY b` | 能，且排序不需 filesort | a 定值后 b 已有序 |

**核心原理**：联合索引按照定义顺序排列，只有左边的列确定了，右边的列才是有序的。范围查询会"打断"后续列的有序性。

> **一句话记忆：** 联合索引从左开始匹配，遇到范围查询（>、<、BETWEEN、LIKE）就停止，后面的列用不到索引。

### 3.3 覆盖索引——避免回表的利器

```
场景: 表 users(id, name, age, email)
索引: INDEX(name, age)

-- 需要回表（要查 email，索引里没有）
SELECT * FROM users WHERE name = '张三';
  name索引 → 找到id → 回主键索引取整行 → 返回所有列

-- 不需要回表（查的列都在索引里，就是覆盖索引）
SELECT id, name, age FROM users WHERE name = '张三';
  name索引中已包含 name, age, id(主键) → 直接返回
```

**EXPLAIN 中的标志**：当使用覆盖索引时，Extra 列会显示 `Using index`。

```sql
EXPLAIN SELECT name, age FROM users WHERE name = '张三';
-- Extra: Using index  ← 这就是覆盖索引的标志
```

**Java 开发实践**：

```java
// 不好：SELECT *，无法利用覆盖索引
String sql = "SELECT * FROM users WHERE name = ?";

// 好：只查需要的列，可以利用覆盖索引
String sql = "SELECT id, name, age FROM users WHERE name = ?";
```

> **一句话记忆：** 覆盖索引的本质是"索引中已包含查询所需的所有列"，省去回表 IO，这是最常用的查询优化手段。

### 3.4 索引下推（ICP, Index Condition Pushdown）

MySQL 5.6 引入的优化，将 WHERE 中能在索引层过滤的条件"下推"到存储引擎层处理。

```
场景: 表 users(id, name, age, gender)
索引: INDEX(name, age)
查询: SELECT * FROM users WHERE name LIKE '张%' AND age = 25;

───── 没有 ICP（MySQL 5.6 之前）─────

  步骤1: InnoDB 通过索引找到所有 name LIKE '张%' 的记录（假设100条）
  步骤2: 把100条记录的主键返回给 Server 层
  步骤3: Server 层拿着100个主键回表取完整行
  步骤4: Server 层逐一判断 age = 25，过滤掉不满足的
  结果:  回表100次，但可能只有5条满足 age = 25

───── 有 ICP（MySQL 5.6+）─────

  步骤1: InnoDB 通过索引找到所有 name LIKE '张%' 的记录
  步骤2: 在索引层直接判断 age = 25（因为 age 在联合索引中）
  步骤3: 只把满足条件的5条记录的主键返回给 Server 层
  步骤4: Server 层只回表5次
  结果:  回表5次，IO 大幅减少
```

EXPLAIN 中的标志：Extra 列显示 `Using index condition`。

> **一句话记忆：** 索引下推把能在索引中判断的条件提前过滤，减少回表次数，5.6+ 默认开启。

### 3.5 索引失效的十大场景

下面的情况会导致索引无法使用（假设列 col 上有索引）：

```sql
-- 1. 对索引列使用函数
SELECT * FROM t WHERE YEAR(create_time) = 2024;     -- 失效
SELECT * FROM t WHERE create_time >= '2024-01-01'
                  AND create_time < '2025-01-01';    -- 走索引

-- 2. 对索引列做运算
SELECT * FROM t WHERE id + 1 = 10;                   -- 失效
SELECT * FROM t WHERE id = 9;                        -- 走索引

-- 3. 隐式类型转换
-- phone 列是 varchar 类型
SELECT * FROM t WHERE phone = 13800138000;           -- 失效（字符串与数字比较）
SELECT * FROM t WHERE phone = '13800138000';         -- 走索引

-- 4. 隐式字符集转换
-- 两个表字符集不同时 JOIN 会导致索引失效

-- 5. LIKE 以通配符开头
SELECT * FROM t WHERE name LIKE '%三';               -- 失效
SELECT * FROM t WHERE name LIKE '张%';               -- 走索引

-- 6. 使用 OR 且其中一个条件没有索引
SELECT * FROM t WHERE indexed_col = 1 OR no_index_col = 2;  -- 整体失效

-- 7. 使用 NOT IN / NOT EXISTS（在某些场景下）
SELECT * FROM t WHERE id NOT IN (1, 2, 3);           -- 可能不走索引

-- 8. IS NOT NULL（在某些场景下）
SELECT * FROM t WHERE name IS NOT NULL;              -- 可能不走索引

-- 9. 联合索引不满足最左前缀
-- INDEX(a, b, c)
SELECT * FROM t WHERE b = 1;                         -- 失效

-- 10. 优化器认为全表扫描更快
-- 当查询结果集超过表的约 30% 时，优化器可能放弃索引
SELECT * FROM t WHERE status = 1;                    -- 如果 90% 的行 status=1，不走索引

-- 11.（补充）使用 != 或 <>
SELECT * FROM t WHERE status != 1;                   -- 可能不走索引
```

**Java 开发中的常见陷阱**：

```java
// 陷阱: MyBatis 中的动态 SQL 可能导致隐式转换
// Mapper.xml 中: WHERE phone = #{phone}
// 如果 Java 传入 Long 类型而数据库是 VARCHAR，就会隐式转换导致索引失效
```

> **一句话记忆：** 索引失效的核心是"破坏了 B+ 树的有序性"，函数、运算、类型转换都会导致 MySQL 无法利用索引的有序结构。

### 3.6 索引选择性与基数

**选择性（Selectivity）** = 不同值数量 / 总行数，范围 [0, 1]。

```sql
-- 查看索引基数（Cardinality）
SHOW INDEX FROM users;

-- 性别列: 只有 男/女 两个值，选择性 ≈ 2/10000000 ≈ 0
-- 身份证号: 每行不同，选择性 = 1

-- 索引选择性越接近 1，索引效果越好
-- 选择性 < 0.1 的列，通常不值得建索引
```

### 3.7 索引选择决策框架

```
是否需要建索引？
├── WHERE 条件频繁使用？ ─── 是 → 考虑建索引
├── ORDER BY / GROUP BY 频繁使用？ ─── 是 → 考虑建索引
├── 表数据量很小（< 几千行）？ ─── 是 → 不需要
└── 列的选择性太低（如 status 只有 0/1）？ ─── 是 → 通常不需要

单列 vs 联合索引？
├── 多个列经常一起出现在 WHERE 中？ ─── 联合索引
├── 需要利用覆盖索引？ ─── 联合索引
└── 联合索引的列顺序怎么排？
    ├── 等值查询的列放前面
    ├── 范围查询的列放后面
    └── 选择性高的列放前面（在前两条满足的前提下）
```

> **一句话记忆：** 建索引看选择性和查询模式，联合索引遵循"等值在前、范围在后、高选择性优先"原则。

---

## 4. 事务与锁机制

### 4.1 ACID 的实现原理

ACID 不是四个独立概念，它们有底层实现的支撑：

```
┌─────────────────────────────────────────────────┐
│                    ACID                          │
│                                                  │
│  A (原子性)  ←── undo log（回滚日志）             │
│     全做或全不做，失败时通过 undo log 回滚         │
│                                                  │
│  C (一致性)  ←── 约束 + 应用逻辑 + AID 共同保证    │
│     数据库约束（主键、外键、NOT NULL 等）           │
│     + 应用层业务逻辑保证                          │
│                                                  │
│  I (隔离性)  ←── MVCC + 锁机制                    │
│     读用 MVCC，写用锁                             │
│                                                  │
│  D (持久性)  ←── redo log + WAL 机制              │
│     先写日志再写数据，崩溃后通过 redo log 恢复      │
└─────────────────────────────────────────────────┘
```

> **一句话记忆：** A 靠 undo log，I 靠 MVCC + 锁，D 靠 redo log，三者共同保障 C。

### 4.2 四个隔离级别——真实行为演示

#### 隔离级别对照表

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 实现方式 |
|---------|------|----------|------|---------|
| READ UNCOMMITTED | 可能 | 可能 | 可能 | 直接读最新数据 |
| READ COMMITTED (RC) | 不会 | 可能 | 可能 | 每次读生成新 ReadView |
| REPEATABLE READ (RR) | 不会 | 不会 | 大部分不会 | 事务首次读生成 ReadView |
| SERIALIZABLE | 不会 | 不会 | 不会 | 所有读加共享锁 |

MySQL 默认使用 **REPEATABLE READ**，而多数其他数据库默认 READ COMMITTED。

#### RC vs RR 的核心区别

```
时间线:  T1              T2              T3              T4
────────┬───────────────┬───────────────┬───────────────┬─────
事务A:  BEGIN           SELECT          |               SELECT
        |               读 name='张三'   |               读到什么？
事务B:  |               |               UPDATE
        |               |               SET name='李四'
        |               |               WHERE id=1
        |               |               COMMIT

RC 级别下:
  T2时刻: 事务A读到 name='张三'
  T4时刻: 事务A读到 name='李四' ← 能读到事务B已提交的修改（不可重复读！）

RR 级别下:
  T2时刻: 事务A读到 name='张三'
  T4时刻: 事务A读到 name='张三' ← 看不到事务B的修改（可重复读！）
```

#### 幻读问题与 RR 的解决

```
幻读场景:

时间线:  T1              T2              T3              T4
────────┬───────────────┬───────────────┬───────────────┬─────
事务A:  BEGIN           SELECT COUNT(*)  |               SELECT COUNT(*)
        |               WHERE age>20    |               WHERE age>20
        |               结果: 5         |               结果: ?
事务B:  |               |               INSERT INTO users
        |               |               (name,age) VALUES('新人',25)
        |               |               COMMIT

RR 级别下的快照读:
  T4: 事务A读到 COUNT(*)=5 ← MVCC 保证看不到新插入的行

但！当前读（SELECT ... FOR UPDATE）可能出现幻读:
  T4: SELECT COUNT(*) FROM users WHERE age>20 FOR UPDATE;
  结果可能是 6 ← 因为当前读绕过了 MVCC

InnoDB 的解决方案: next-key lock（间隙锁 + 记录锁）
  在 RR 级别下，SELECT ... FOR UPDATE 会对查询范围加 next-key lock，
  阻止其他事务在该范围内插入新行。
```

> **一句话记忆：** RC 每次读创建新快照（能看到别人新提交的），RR 全程复用第一次的快照（看不到），幻读靠 next-key lock 解决。

### 4.3 MVCC 深入剖析

#### 隐藏列

InnoDB 为每行数据额外存储三个隐藏列：

| 隐藏列 | 大小 | 含义 |
|-------|------|------|
| DB_TRX_ID | 6 字节 | 最近修改该行的事务 ID |
| DB_ROLL_PTR | 7 字节 | 指向 undo log 中该行的上一版本 |
| DB_ROW_ID | 6 字节 | 隐含自增 ID（无主键时 InnoDB 自动生成） |

#### 版本链

```
当前数据行 (在数据页中):
┌──────────────────────────────────────┐
│ id=1, name='王五', age=30            │
│ DB_TRX_ID = 300                      │
│ DB_ROLL_PTR ──────────┐              │
└──────────────────────────────────────┘
                         │
                         ▼  (undo log)
                ┌──────────────────────┐
                │ id=1, name='李四'     │
                │ DB_TRX_ID = 200      │
                │ DB_ROLL_PTR ────┐    │
                └──────────────────────┘
                                  │
                                  ▼  (undo log)
                         ┌──────────────────────┐
                         │ id=1, name='张三'     │
                         │ DB_TRX_ID = 100      │
                         │ DB_ROLL_PTR = NULL    │
                         └──────────────────────┘

版本链就是通过 DB_ROLL_PTR 串起来的链表，从新到旧。
```

#### ReadView 机制

一个 ReadView 包含四个关键字段：

```
ReadView 结构:
┌──────────────────────────────────────────────┐
│ creator_trx_id: 创建该 ReadView 的事务 ID      │
│ m_ids:          创建时所有活跃（未提交）事务 ID 列表│
│ min_trx_id:     m_ids 中的最小值               │
│ max_trx_id:     系统应该分配的下一个事务 ID      │
└──────────────────────────────────────────────┘
```

#### 可见性判断流程

对于版本链中的某一版本，其 `DB_TRX_ID = trx_id`，判断流程如下：

```
                    ┌──────────────┐
                    │ 取版本链中    │
                    │ 某版本的      │
                    │ trx_id       │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
             是     │ trx_id ==    │
          ┌─────── │ creator_trx_id│
          │  可见   └──────┬───────┘
          │                │ 否
          │         ┌──────▼───────┐
          │  是     │ trx_id <     │
          ├─────── │ min_trx_id   │
          │  可见   └──────┬───────┘
          │                │ 否
          │         ┌──────▼───────┐
          │  是     │ trx_id >=    │
          │ ┌───── │ max_trx_id   │
          │ │不可见  └──────┬───────┘
          │ │              │ 否
          │ │       ┌──────▼───────┐
          │ │ 是    │ trx_id 在    │
          │ ├───── │ m_ids 中?    │
          │ │不可见  └──────┬───────┘
          │ │              │ 否
          │ │              │ 可见
          ▼ ▼              ▼
```

翻译成规则：
1. 如果 trx_id 等于自己（creator_trx_id）→ **可见**（自己的修改当然可见）
2. 如果 trx_id 小于 min_trx_id → **可见**（在 ReadView 创建前已提交）
3. 如果 trx_id 大于等于 max_trx_id → **不可见**（在 ReadView 创建后才出现）
4. 如果 trx_id 在 [min_trx_id, max_trx_id) 之间：
   - 在 m_ids 中 → **不可见**（创建 ReadView 时还未提交）
   - 不在 m_ids 中 → **可见**（创建 ReadView 前已提交）

如果当前版本不可见，沿着版本链找上一版本，重复判断，直到找到可见版本或到达链尾。

#### RC 和 RR 的 ReadView 差异

```
RC（Read Committed）:
  每次 SELECT 都重新生成一个 ReadView
  → 能看到其他事务在两次 SELECT 之间提交的修改

RR（Repeatable Read）:
  只在事务的第一次 SELECT 时生成 ReadView，后续复用
  → 整个事务期间看到的数据快照一致
```

> **一句话记忆：** MVCC 的核心是"版本链 + ReadView"，RC 每次读创建新 ReadView，RR 只用第一次的，这决定了两者可见性的差异。

### 4.4 锁类型层级

```
MySQL 锁体系:

全局锁
├── FTWRL (Flush Tables With Read Lock)
│   └── 全库只读，用于全库逻辑备份
│
表级锁
├── 表锁 (LOCK TABLES ... READ/WRITE)
├── 元数据锁 (MDL Lock)
│   └── DML 自动加 MDL 读锁，DDL 自动加 MDL 写锁
│   └── 长事务 + DDL = 阻塞灾难
├── 意向锁 (Intention Lock)
│   ├── 意向共享锁 (IS)
│   └── 意向排他锁 (IX)
│   └── 目的: 快速判断表中是否有行锁，避免逐行检查
│
行级锁（InnoDB 特有）
├── 记录锁 (Record Lock)
│   └── 锁定索引中的一条记录
├── 间隙锁 (Gap Lock)
│   └── 锁定索引记录之间的间隙（左开右开）
├── 临键锁 (Next-Key Lock)
│   └── 记录锁 + 间隙锁（左开右闭），InnoDB 默认的行锁
└── 插入意向锁 (Insert Intention Lock)
    └── 插入前检查间隙是否被锁
```

#### 行锁的加锁范围示例

```
假设表中 id 列有值: 5, 10, 15, 20

数轴表示:  (-∞, 5] (5, 10] (10, 15] (15, 20] (20, +∞)

SELECT * FROM t WHERE id = 10 FOR UPDATE;
  → 加 Next-Key Lock: (5, 10]
  → 但因为是等值查询且唯一索引，退化为 Record Lock: 只锁 id=10

SELECT * FROM t WHERE id > 10 AND id < 18 FOR UPDATE;
  → 加 Next-Key Lock: (10, 15] 和 (15, 20]
  → 间隙(10,15)、记录15、间隙(15,20)、记录20 都被锁定
  → 其他事务无法在此范围插入数据
```

#### 意向锁存在的意义

```
场景: 事务A对 id=5 的行加了行级排他锁
      事务B想对整个表加表级排他锁

没有意向锁: 事务B需要遍历每一行检查是否有行锁 → 极慢
有意向锁:   事务A在加行锁前先加 IX（意向排他锁）
            事务B看到表上有 IX → 立即知道有行锁冲突 → 等待
```

#### 行锁升级为表锁的场景

InnoDB 行锁是**加在索引上的**，如果查询没有走索引，就会退化为表锁：

```sql
-- 假设 name 列没有索引
SELECT * FROM users WHERE name = '张三' FOR UPDATE;
-- 由于无法走索引定位到具体行，InnoDB 对全表所有行加锁 → 效果等同于表锁
```

> **一句话记忆：** InnoDB 行锁锁的是索引，无索引则退化为表锁；Next-Key Lock = 记录锁 + 间隙锁，是防止幻读的关键。

### 4.5 死锁

#### 死锁如何产生

```
经典死锁场景:

事务A:                          事务B:
BEGIN;                          BEGIN;
UPDATE t SET v=1 WHERE id=1;    UPDATE t SET v=1 WHERE id=2;
-- 锁住 id=1                    -- 锁住 id=2
...                             ...
UPDATE t SET v=1 WHERE id=2;    UPDATE t SET v=1 WHERE id=1;
-- 等待 id=2 的锁（被事务B持有）  -- 等待 id=1 的锁（被事务A持有）

→ 互相等待 → 死锁！
```

#### 死锁检测与解决

InnoDB 的两种策略：

1. **等待超时**：`innodb_lock_wait_timeout`（默认 50 秒），超时后回滚
2. **死锁检测**：`innodb_deadlock_detect=ON`（默认开启），主动检测等待图中的环，发现即回滚代价较小的事务

#### 死锁预防策略

```
1. 固定加锁顺序: 所有事务按相同顺序访问表和行
   如: 总是先锁 id 小的行，再锁 id 大的行

2. 大事务拆小: 减少锁的持有时间

3. 合理使用索引: 避免因无索引导致的大范围锁

4. 降低隔离级别: RC 比 RR 锁更少（没有间隙锁）
```

**Java 开发中的处理**：

```java
// 死锁发生时 MySQL 会抛出异常，捕获后重试
int maxRetries = 3;
for (int i = 0; i < maxRetries; i++) {
    try {
        doBusinessLogic();
        break;  // 成功则退出
    } catch (SQLException e) {
        if (e.getErrorCode() == 1213) {  // ER_LOCK_DEADLOCK
            log.warn("死锁检测到，第{}次重试", i + 1);
            if (i == maxRetries - 1) throw e;
        } else {
            throw e;
        }
    }
}
```

> **一句话记忆：** 死锁是两个事务互相等待对方持有的锁，预防靠"固定顺序加锁 + 事务尽量小 + 合理索引"，代码层面要做重试。

---

## 5. 日志系统三剑客

### 5.1 redo log（重做日志）

#### 为什么要有 redo log

如果每次修改数据都直接写磁盘上的数据页（随机 IO），性能极差。

**WAL（Write-Ahead Logging）策略**：先把修改记录写到日志文件（顺序 IO），等空闲时再把数据页写回磁盘。即使崩溃，也能通过 redo log 恢复。

顺序写的速度远快于随机写，这就是 WAL 的性能优势。

#### 循环缓冲区结构

redo log 是固定大小的文件组，以循环方式写入：

```
redo log 循环缓冲:

    ┌───────────────────────────────────────────┐
    │                                           │
    │    write pos                              │
    │    (当前写入位置)                           │
    │       ↓                                   │
    │   ┌───┬───┬───┬───┬───┬───┬───┬───┐      │
    │   │///│///│///│   │   │   │///│///│      │
    │   │///│///│///│   │   │   │///│///│      │
    │   └───┴───┴───┴───┴───┴───┴───┴───┘      │
    │                               ↑           │
    │                          checkpoint       │
    │                          (已刷盘位置)      │
    │                                           │
    │   /// = 已写入但未刷盘的 redo log            │
    │       = 空闲空间，可以写入新日志             │
    │                                           │
    │   write pos 追上 checkpoint →               │
    │   必须停下来先刷脏页，推进 checkpoint        │
    └───────────────────────────────────────────┘

    write pos 顺时针前进: 不断写入新日志
    checkpoint 顺时针前进: 对应的脏页已刷盘，空间可复用
    两者之间的区域: 待刷盘的日志
```

#### 关键配置

```sql
-- redo log 文件配置（MySQL 8.0.30+）
innodb_redo_log_capacity = 2G  -- 总大小

-- 刷盘策略（非常重要！）
innodb_flush_log_at_trx_commit:
  = 0: 每秒刷一次（可能丢1秒数据）
  = 1: 每次提交都刷盘（最安全，默认值）
  = 2: 每次提交写到 OS 缓存，每秒 fsync
```

> **一句话记忆：** redo log 实现 WAL，把随机写变顺序写，循环缓冲结构让固定大小的文件可以反复使用，`innodb_flush_log_at_trx_commit=1` 保证不丢数据。

### 5.2 undo log（回滚日志）

undo log 有两个核心作用：

1. **事务回滚**：记录数据修改前的值，回滚时"反向操作"
2. **MVCC 版本链**：为一致性读提供历史版本

```
undo log 的版本链:

INSERT 操作: 记录主键值，回滚时 DELETE
DELETE 操作: 记录整行数据，回滚时 INSERT
UPDATE 操作: 记录修改前的旧值，回滚时用旧值 UPDATE

事务100: INSERT (id=1, name='张三')
事务200: UPDATE SET name='李四' WHERE id=1
事务300: UPDATE SET name='王五' WHERE id=1

数据页中当前行:
┌──────────────────────────────────┐
│ id=1, name='王五', trx_id=300    │──→ undo log:
└──────────────────────────────────┘    ┌───────────────────┐
                                        │ name='李四'        │
                                        │ trx_id=200        │──→ undo log:
                                        └───────────────────┘    ┌───────────────┐
                                                                  │ name='张三'    │
                                                                  │ trx_id=100    │
                                                                  │ roll_ptr=NULL │
                                                                  └───────────────┘
MVCC 读取时沿着这条链找到对自己可见的版本。
```

**undo log 何时清理？**

当没有任何活跃事务需要读取该版本时，purge 线程会清理。这也是为什么**长事务会导致 undo log 暴涨**——老版本无法被清理。

> **一句话记忆：** undo log 记录"修改前的样子"，既支持回滚也支持 MVCC，长事务是它的天敌。

### 5.3 binlog（归档日志）

binlog 是 Server 层的日志（不是 InnoDB 独有），记录所有修改操作，用于：

1. **主从复制**：从库通过 binlog 同步主库数据
2. **数据恢复**：基于时间点的数据恢复（PITR）

#### 三种格式对比

| 格式 | 记录内容 | 优点 | 缺点 |
|------|---------|------|------|
| STATEMENT | SQL 原文 | 日志量小 | 有些函数（NOW()、UUID()）在从库执行结果不同 |
| ROW | 行数据变更（修改前后的值） | 精确，不会有主从不一致 | 日志量大（尤其批量操作） |
| MIXED | 自动选择（默认 STATEMENT，不安全时切 ROW） | 折中方案 | 仍有边界情况 |

**生产建议**：使用 **ROW 格式**，虽然日志量大但保证主从一致性。

```sql
-- 查看 binlog 格式
SHOW VARIABLES LIKE 'binlog_format';

-- 查看 binlog 列表
SHOW BINARY LOGS;

-- 查看 binlog 事件
SHOW BINLOG EVENTS IN 'mysql-bin.000001' LIMIT 10;
```

> **一句话记忆：** binlog 是 Server 层日志，ROW 格式记录行变更保证主从一致，是复制和恢复的基础。

### 5.4 三个日志的关系

```
┌──────────────────────────────────────────────────────────┐
│                    一次 UPDATE 操作                        │
│                                                           │
│  1. 开始事务                                              │
│  2. 从 Buffer Pool 读取数据页（不在则从磁盘加载）           │
│  3. 记录修改前数据到 undo log（用于回滚和 MVCC）           │
│  4. 修改 Buffer Pool 中的数据页（此时为脏页）              │
│  5. 写 redo log 到 redo log buffer                       │
│  6. 提交时 → 触发两阶段提交:                               │
│     ├── 6a. redo log 写入磁盘（prepare 状态）             │
│     ├── 6b. binlog 写入磁盘                              │
│     └── 6c. redo log 标记为 commit 状态                   │
│  7. 后台线程择机将脏页刷回磁盘                             │
└──────────────────────────────────────────────────────────┘

redo log: InnoDB 引擎层，保证崩溃恢复（持久性）
undo log: InnoDB 引擎层，保证回滚和 MVCC（原子性、隔离性）
binlog:   Server 层，保证主从复制和数据恢复
```

### 5.5 两阶段提交（2PC）

#### 为什么需要两阶段提交

假设没有 2PC，redo log 和 binlog 分开写：

```
场景1: 先写 redo log，后写 binlog
  redo log 写成功 → MySQL 崩溃 → binlog 未写
  重启后: 主库通过 redo log 恢复了数据
          从库没有对应 binlog → 主从数据不一致！

场景2: 先写 binlog，后写 redo log
  binlog 写成功 → MySQL 崩溃 → redo log 未写
  重启后: 主库数据没有恢复
          从库已经通过 binlog 同步了 → 从库多出了数据！
```

#### 两阶段提交流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Prepare    │────→│  Write       │────→│   Commit     │
│   Phase      │     │  binlog      │     │   Phase      │
│              │     │              │     │              │
│ redo log     │     │ binlog       │     │ redo log     │
│ 写入 prepare │     │ 写入磁盘     │     │ 标记 commit  │
│ 状态         │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘

崩溃恢复规则:
├── redo log = prepare, binlog 完整 → 提交（补 commit 标记）
├── redo log = prepare, binlog 不完整 → 回滚
└── redo log = commit → 正常，已提交
```

这样无论在哪个阶段崩溃，都能保证 redo log 和 binlog 的一致性。

> **一句话记忆：** 两阶段提交保证 redo log 和 binlog 的一致性，先 prepare 再写 binlog 最后 commit，崩溃时根据两者状态决定提交或回滚。

---

## 6. 查询优化器与执行

### 6.1 基于成本的优化器（CBO）

MySQL 优化器不是基于规则的，而是**基于成本（Cost-Based）** 的。

```
优化器决策流程:

SQL 语句
   │
   ▼
生成所有可能的执行计划
   │
   ▼
对每个计划估算成本
├── IO 成本: 从磁盘读数据页的代价
│   └── 1 页 = 1.0（成本单位）
├── CPU 成本: 处理每行数据的代价
│   └── 1 行 = 0.2（成本单位）
   │
   ▼
选择成本最低的计划
```

可以通过 EXPLAIN 查看优化器的选择：

```sql
EXPLAIN SELECT * FROM users WHERE age > 20 AND name = '张三';

-- key 列: 实际选择的索引
-- rows 列: 预估扫描行数
-- filtered 列: 预估过滤百分比
-- Extra 列: 额外信息（Using index, Using filesort 等）

-- 8.0+ 可以查看优化器成本估算
EXPLAIN FORMAT=JSON SELECT ...;
-- 在输出中搜索 "query_cost" 字段
```

**优化器为什么有时候不走索引？**

因为优化器估算出全表扫描的成本更低，常见原因：
- 查询结果集占比太大（超过约 30%）
- 需要回表次数太多（每次回表都是一次随机 IO）
- 索引基数统计信息不准确

```sql
-- 强制使用索引（谨慎使用，一般优化器比你聪明）
SELECT * FROM users FORCE INDEX(idx_name) WHERE name = '张三';

-- 更新统计信息（解决基数不准的问题）
ANALYZE TABLE users;
```

> **一句话记忆：** 优化器基于成本模型选执行计划，IO 成本 + CPU 成本最低者胜出，统计信息不准时用 ANALYZE TABLE 刷新。

### 6.2 JOIN 算法

#### Nested Loop Join（嵌套循环连接）

```
驱动表(小表) t1: 10 行
被驱动表(大表) t2: 1000 行，join 列有索引

for each row r1 in t1:          -- 扫描 10 行
    通过索引查找 t2 中匹配的行    -- 每次索引查找 ≈ 3-4次IO
    输出匹配结果

总成本 ≈ 10 + 10 * 3 = 40 次 IO
```

**核心原则**：**小表驱动大表**，被驱动表的 join 列上必须有索引。

#### Block Nested Loop Join（BNL, MySQL 8.0.18 前）

当被驱动表 join 列**没有索引**时：

```
不用 BNL:
  for each row in t1:           -- 10 行
      for each row in t2:       -- 1000 行
          比较                   -- 10 * 1000 = 10000 次磁盘扫描 t2

用 BNL（join_buffer_size）:
  把 t1 的数据读到 join buffer 中
  for each row in t2:           -- 只需扫描 t2 一次（1000行）
      与 join buffer 中 t1 的所有行比较（内存操作，快！）

  总成本 ≈ 10 + 1000 = 1010 次 IO（大幅减少）
```

#### Hash Join（MySQL 8.0.18+）

MySQL 8.0.18 引入 Hash Join 取代 BNL：

```
步骤1（Build 阶段）: 对小表建立哈希表（在内存中）
  t1 的 join 列值 → 哈希表

步骤2（Probe 阶段）: 扫描大表，对每行计算哈希值去查表
  for each row in t2:
      hash(join_col) → 在哈希表中查找 → O(1)

总成本 ≈ 10 + 1000 = 1010，但比较操作是 O(1) 而非 O(n)
```

> **一句话记忆：** JOIN 优化三原则——小表驱动大表，被驱动表 join 列建索引，8.0+ 无索引时用 Hash Join 替代 BNL。

### 6.3 排序算法

当 ORDER BY 无法利用索引时，MySQL 需要进行 **filesort**。

```
两种 filesort 算法:

全字段排序（默认）:
  1. 把满足条件的行的【所有查询列】放入 sort_buffer
  2. 在 sort_buffer 中排序
  3. 直接返回结果
  优点: 不需要回表
  缺点: sort_buffer 中每行数据量大，放不下就要用磁盘临时文件

rowid 排序:
  1. 只把【排序列 + 主键】放入 sort_buffer
  2. 在 sort_buffer 中排序
  3. 按排序后的主键回表取完整行
  触发条件: 单行长度 > max_length_for_sort_data（默认4096字节）
  优点: sort_buffer 能放更多行
  缺点: 需要回表

最优方案: 让排序利用索引，避免 filesort
  -- INDEX(city, age)
  SELECT * FROM users WHERE city='北京' ORDER BY age;
  -- city 确定后 age 已有序，无需 filesort
```

```sql
-- 查看排序是否使用了 filesort
EXPLAIN SELECT * FROM users ORDER BY age;
-- Extra: Using filesort  ← 需要优化

-- 调整 sort_buffer 大小
SET sort_buffer_size = 2 * 1024 * 1024;  -- 2MB
```

> **一句话记忆：** 避免 filesort 的最好方式是让 ORDER BY 走索引，走不了时靠 sort_buffer 在内存排序。

### 6.4 临时表与子查询

#### MySQL 何时创建内部临时表

```
以下情况会创建内部临时表:
1. GROUP BY 的列不在索引中
2. DISTINCT + ORDER BY 使用不同列
3. UNION（不是 UNION ALL）
4. 部分子查询
5. ORDER BY 与 GROUP BY 使用不同列

EXPLAIN 中的标志: Extra 列出现 Using temporary
```

#### 子查询优化

```sql
-- 低效: 依赖子查询（对外部每一行执行一次子查询）
SELECT * FROM orders o
WHERE o.user_id IN (
    SELECT id FROM users WHERE age > 20
);

-- MySQL 优化器通常会将 IN 子查询改写为 semi-join:
-- 等效于:
SELECT o.* FROM orders o
SEMI JOIN users u ON o.user_id = u.id
WHERE u.age > 20;

-- 但 NOT IN 子查询优化较差，建议改写为 LEFT JOIN + IS NULL:
-- 低效:
SELECT * FROM orders WHERE user_id NOT IN (SELECT id FROM blacklist);

-- 改写:
SELECT o.* FROM orders o
LEFT JOIN blacklist b ON o.user_id = b.id
WHERE b.id IS NULL;
```

> **一句话记忆：** 看到 EXPLAIN 中出现 Using temporary + Using filesort 就要警觉，子查询尽量改写为 JOIN。

---

## 7. 高可用与扩展

### 7.1 主从复制原理

```
主从复制的三个线程:

┌─────────────────────────────────────────────────────────┐
│                        主库 (Master)                     │
│                                                          │
│  ┌──────────┐    ┌────────────────┐                     │
│  │ 业务写入  │───→│ binlog 文件     │                     │
│  └──────────┘    └───────┬────────┘                     │
│                          │                               │
│                  ┌───────▼────────┐                      │
│                  │ Binlog Dump    │  ← 线程1: 读binlog   │
│                  │ Thread         │     推送给从库        │
│                  └───────┬────────┘                      │
└──────────────────────────┼──────────────────────────────┘
                           │ 网络传输
┌──────────────────────────▼──────────────────────────────┐
│                        从库 (Slave)                      │
│                                                          │
│                  ┌───────────────┐                       │
│                  │ IO Thread     │  ← 线程2: 接收binlog  │
│                  │               │     写入 relay log    │
│                  └───────┬───────┘                       │
│                          │                               │
│                  ┌───────▼───────┐                       │
│                  │ Relay Log     │  ← 中继日志           │
│                  └───────┬───────┘                       │
│                          │                               │
│                  ┌───────▼───────┐                       │
│                  │ SQL Thread    │  ← 线程3: 重放 SQL    │
│                  │               │     写入从库数据       │
│                  └───────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

### 7.2 复制模式对比

| 模式 | 原理 | 数据安全 | 性能 |
|------|------|---------|------|
| 异步复制 | 主库提交后立刻返回，不等从库确认 | 可能丢数据 | 最高 |
| 半同步复制 | 主库等至少一个从库确认收到 relay log | 较安全 | 较高 |
| 组复制（MGR） | 基于 Paxos 协议的多主复制 | 最安全 | 较低 |

```sql
-- 半同步复制配置
-- 主库:
INSTALL PLUGIN rpl_semi_sync_master SONAME 'semisync_master.so';
SET GLOBAL rpl_semi_sync_master_enabled = 1;
SET GLOBAL rpl_semi_sync_master_timeout = 1000;  -- 1秒超时降级为异步

-- 从库:
INSTALL PLUGIN rpl_semi_sync_slave SONAME 'semisync_slave.so';
SET GLOBAL rpl_semi_sync_slave_enabled = 1;
```

#### GTID 模式

GTID（Global Transaction ID）= source_id:transaction_id，全局唯一标识一个事务。

```
传统模式: 从库记录"复制到了主库 binlog 的哪个文件的哪个位置"
          → 主库切换后位置对不上，容易出错

GTID 模式: 从库记录"已执行过哪些 GTID 的事务"
           → 切换主库后自动跳过已执行的事务，简单可靠

GTID 格式: 3E11FA47-71CA-11E1-9E33-C80AA9429562:1-100
           服务器UUID:事务序号范围
```

> **一句话记忆：** 主从复制靠三个线程（Dump、IO、SQL），GTID 模式让主从切换更安全可靠，生产必开。

### 7.3 主从延迟

#### 延迟原因

```
1. 从库单线程重放
   主库并发写入，但从库 SQL Thread 默认单线程 → 跟不上
   解决: 开启并行复制（MySQL 5.7+ 基于组提交的并行复制）

2. 从库机器性能差
   从库用了较差的机器 → CPU/IO 跟不上
   解决: 主从使用相同规格机器

3. 大事务
   主库执行一个10分钟的大事务，从库也要10分钟重放
   解决: 拆分大事务

4. 从库上有大查询
   从库被慢查询拖住资源
   解决: 对从库查询做资源隔离

5. 网络延迟
   主从之间网络不稳定
   解决: 同机房部署
```

```sql
-- 查看从库延迟
SHOW SLAVE STATUS\G
-- 关注 Seconds_Behind_Master 字段

-- 开启并行复制（MySQL 5.7+）
SET GLOBAL slave_parallel_type = 'LOGICAL_CLOCK';
SET GLOBAL slave_parallel_workers = 8;
```

> **一句话记忆：** 主从延迟的本质是从库重放速度跟不上主库写入速度，并行复制和拆分大事务是主要解决手段。

### 7.4 读写分离

```
读写分离架构:

         ┌──────────┐
         │ 应用程序  │
         └─────┬────┘
               │
         ┌─────▼────┐
         │ 代理层    │  ← ShardingSphere-Proxy / MyCat / ProxySQL
         │ 或        │  ← 或应用层路由（ShardingSphere-JDBC）
         │ 中间件    │
         └──┬────┬──┘
            │    │
     写请求 │    │ 读请求
            ▼    ▼
     ┌──────┐  ┌──────┐ ┌──────┐
     │ 主库  │  │从库1  │ │从库2  │
     │Master│→│Slave1│ │Slave2│
     └──────┘  └──────┘ └──────┘
```

**Java 中基于 ShardingSphere-JDBC 的读写分离**：

```java
// application.yml 配置（Spring Boot + ShardingSphere）
// spring:
//   shardingsphere:
//     datasource:
//       names: master, slave0, slave1
//       master:
//         url: jdbc:mysql://master:3306/mydb
//       slave0:
//         url: jdbc:mysql://slave0:3306/mydb
//       slave1:
//         url: jdbc:mysql://slave1:3306/mydb
//     rules:
//       readwrite-splitting:
//         data-sources:
//           myds:
//             write-data-source-name: master
//             read-data-source-names: slave0, slave1
//             load-balancer-name: round-robin

// 代码层面完全透明，无需修改业务代码
@Service
public class UserService {
    @Autowired
    private UserMapper userMapper;

    public User getUser(Long id) {
        return userMapper.selectById(id);  // 自动路由到从库
    }

    @Transactional
    public void updateUser(User user) {
        userMapper.updateById(user);       // 自动路由到主库
    }
}
```

**注意点**：刚写入的数据立刻读可能因主从延迟读不到，关键业务可强制走主库：

```java
// ShardingSphere 强制主库读
HintManager hintManager = HintManager.getInstance();
hintManager.setWriteRouteOnly();
try {
    return userMapper.selectById(id);  // 强制走主库
} finally {
    hintManager.close();
}
```

> **一句话记忆：** 读写分离靠中间件自动路由，写后立读的场景要强制走主库，否则可能因延迟读到旧数据。

### 7.5 分库分表

#### 垂直拆分 vs 水平拆分

```
垂直拆分（按业务模块拆）:

拆分前:                       拆分后:
┌────────────────┐           ┌──────────┐  ┌──────────┐  ┌──────────┐
│   大单体数据库  │    →      │ 用户库    │  │ 订单库    │  │ 商品库    │
│ users          │           │ users    │  │ orders   │  │ products │
│ orders         │           └──────────┘  │ order_   │  └──────────┘
│ products       │                         │ items    │
│ order_items    │                         └──────────┘
└────────────────┘

优点: 业务清晰，数据库解耦
缺点: 单表数据量大时仍有瓶颈


水平拆分（单表数据拆到多个库/表）:

拆分前:                       拆分后:
┌──────────────┐             ┌──────────┐  ┌──────────┐
│ orders       │      →      │ db0      │  │ db1      │
│ 5000万行     │             │orders_0  │  │orders_0  │
└──────────────┘             │orders_1  │  │orders_1  │
                             └──────────┘  └──────────┘
                             (user_id%4 分布到4个表)
```

#### 分片键选择标准

```
好的分片键:
├── 高频查询条件（WHERE 中最常出现）
├── 数据分布均匀（避免热点）
├── 尽量保证相关数据在同一分片（减少跨分片查询）
└── 很少或不需要修改

示例:
├── 订单表: 按 user_id 分片（同一用户的订单在一起）
├── 用户表: 按 user_id 分片
└── 日志表: 按时间分片（按月/按天）
```

#### ShardingSphere-JDBC 配置示例

```yaml
# application.yml
spring:
  shardingsphere:
    datasource:
      names: ds0, ds1
      ds0:
        url: jdbc:mysql://db0:3306/orders
      ds1:
        url: jdbc:mysql://db1:3306/orders
    rules:
      sharding:
        tables:
          orders:
            actual-data-nodes: ds$->{0..1}.orders_$->{0..3}
            database-strategy:
              standard:
                sharding-column: user_id
                sharding-algorithm-name: db-mod
            table-strategy:
              standard:
                sharding-column: user_id
                sharding-algorithm-name: table-mod
        sharding-algorithms:
          db-mod:
            type: MOD
            props:
              sharding-count: 2      # 2个库
          table-mod:
            type: MOD
            props:
              sharding-count: 4      # 每个库4个表
```

#### 跨分片查询的挑战

```
1. 跨分片 JOIN
   问题: 两张表在不同分片上，无法直接 JOIN
   方案: ① 绑定表（相同分片键的表路由到同一节点）
         ② 广播表（小的字典表每个节点全量存一份）
         ③ 应用层组装

2. 跨分片排序和分页
   问题: SELECT ... ORDER BY time LIMIT 10 OFFSET 100
         需要每个分片都查 110 条，合并后再取 10 条
   方案: 避免深分页，使用游标分页（WHERE id > last_id LIMIT 10）

3. 跨分片聚合
   问题: SUM / COUNT / AVG 需要从所有分片汇总
   方案: 中间件负责归并计算

4. 分布式事务
   问题: 一个业务操作涉及多个分片
   方案: ① ShardingSphere XA 事务
         ② Seata AT 模式
         ③ 最终一致性（消息队列）

5. 全局唯一 ID
   问题: 自增 ID 在不同分片会冲突
   方案: ① 雪花算法（Snowflake）
         ② 号段模式（Leaf）
         ③ UUID（不推荐，作为主键会导致页分裂）
```

**全局 ID 的 Java 实现（雪花算法简要思路）**：

```java
// ShardingSphere 内置雪花算法配置
// sharding-algorithms:
//   snowflake:
//     type: SNOWFLAKE
//     props:
//       worker-id: 1

// 或使用美团 Leaf（号段模式，更适合生产）
// 原理: 从数据库批量取号段缓存到本地，用完再取
// 优点: 趋势递增，不依赖时钟
```

> **一句话记忆：** 分库分表是最后手段，先考虑优化 SQL、加索引、读写分离，万不得已再分。分片键选择决定成败，跨分片查询是最大痛点。

---

## 总结：面试快速回忆清单

| 主题 | 核心要点 |
|------|---------|
| 架构 | Server 层（连接→解析→优化→执行）+ 存储引擎层 |
| InnoDB | B+ 树（矮胖 + 叶子链表）、聚簇索引、Buffer Pool（改进LRU） |
| 索引 | 最左前缀、覆盖索引避免回表、索引下推减少回表、10+ 种失效场景 |
| 事务 | MVCC = 版本链 + ReadView，RC 每次新建 ReadView，RR 复用首次的 |
| 锁 | 行锁锁索引，Next-Key Lock 防幻读，无索引退化表锁 |
| 日志 | redo log（持久性）+ undo log（原子性+MVCC）+ binlog（复制），两阶段提交保一致 |
| 优化器 | CBO 基于成本选计划，小表驱动大表，避免 filesort 和 Using temporary |
| 高可用 | 三线程复制，GTID 模式，并行复制解决延迟，读写分离 + 分库分表 |
