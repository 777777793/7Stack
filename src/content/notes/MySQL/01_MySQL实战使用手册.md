# MySQL 实战使用手册

> 面向 Java 开发者，从零到面试的完整实战指南。所有示例基于 Java 生态（HikariCP、MyBatis、MyBatis-Plus、ShardingSphere）。

---

## 1. MySQL 解决什么问题

### 1.1 关系型数据库的定位

MySQL 是关系型数据库（RDBMS），核心能力是**结构化数据的持久化存储与复杂查询**。它不是万能的，选型时必须清楚边界。

### 1.2 MySQL vs 其他存储的选型对照表

| 场景 | MySQL | Redis | MongoDB | Elasticsearch |
|------|-------|-------|---------|---------------|
| **核心定位** | 结构化数据持久存储 | 内存缓存/高速读写 | 文档型灵活存储 | 全文搜索/聚合分析 |
| **数据一致性** | 强一致（ACID） | 最终一致 | 最终一致 | 最终一致（近实时） |
| **事务支持** | 完整事务 | 单命令原子/Lua脚本 | 4.0+支持多文档事务 | 不支持事务 |
| **复杂查询** | JOIN/子查询/聚合 | 仅KV查询 | 聚合管道 | DSL查询/聚合 |
| **写入性能** | 中等（万级TPS） | 极高（十万级TPS） | 高（数万TPS） | 中等（有刷盘延迟） |
| **适合数据量** | 单表千万级以内 | 内存限制 | 亿级 | 亿级 |
| **典型用途** | 订单/用户/支付 | Session/排行榜/计数器 | 日志/用户画像/内容管理 | 商品搜索/日志检索 |

### 1.3 真实业务场景选型

```
用户注册/登录 → MySQL（账号密码需要事务保证）
商品列表搜索 → Elasticsearch（全文检索+高亮+分词）
购物车 → Redis（高频读写，允许丢失后重建）
订单创建 → MySQL（金额计算必须 ACID）
操作日志 → MongoDB（结构不固定，写入量大）
秒杀库存扣减 → Redis 预扣 + MySQL 最终落库
```

### 1.4 MySQL 的核心优势

- **ACID 事务**：转账场景下，扣款和入账要么同时成功要么同时失败
- **复杂查询**：多表 JOIN、子查询、窗口函数，SQL 表达力极强
- **数据一致性**：外键约束、唯一约束、CHECK 约束，从数据库层面保证数据正确
- **生态成熟**：驱动、ORM、分库分表中间件、监控工具一应俱全

---

## 2. 环境搭建与项目接入

### 2.1 Docker 部署 MySQL

```yaml
# docker-compose.yml
version: '3.8'
services:
  mysql:
    image: mysql:8.0.35
    container_name: mysql8
    restart: always
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: "Root@2024"       # 生产环境用 secrets 管理
      MYSQL_DATABASE: "mall"                  # 自动创建的数据库
      MYSQL_USER: "app_user"                  # 应用账号（非 root）
      MYSQL_PASSWORD: "App@2024"
      TZ: "Asia/Shanghai"                     # 时区必须设置
    volumes:
      - ./mysql/data:/var/lib/mysql           # 数据持久化
      - ./mysql/conf:/etc/mysql/conf.d        # 自定义配置
      - ./mysql/init:/docker-entrypoint-initdb.d  # 初始化SQL
    command:
      --default-authentication-plugin=caching_sha2_password
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --max-connections=500
      --innodb-buffer-pool-size=256M
```

启动命令：

```bash
docker-compose up -d
# 验证连接
docker exec -it mysql8 mysql -uapp_user -p'App@2024' -e "SELECT VERSION();"
```

自定义配置文件 `./mysql/conf/my.cnf`：

```ini
[mysqld]
# 字符集
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# InnoDB 核心参数
innodb_buffer_pool_size = 256M
innodb_log_file_size = 128M
innodb_flush_log_at_trx_commit = 1
innodb_flush_method = O_DIRECT

# 慢查询
slow_query_log = ON
slow_query_log_file = /var/lib/mysql/slow.log
long_query_time = 1

# 连接
max_connections = 500
wait_timeout = 600
interactive_timeout = 600

# binlog（主从复制必须开启）
server-id = 1
log-bin = mysql-bin
binlog_format = ROW
expire_logs_days = 7
```

### 2.2 HikariCP 连接池配置

```yaml
# application.yml
spring:
  datasource:
    # 驱动和连接地址
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/mall?useUnicode=true&characterEncoding=utf8mb4&useSSL=false&serverTimezone=Asia/Shanghai&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true
    username: app_user
    password: App@2024

    # HikariCP 配置
    hikari:
      pool-name: MallHikariPool         # 连接池名称，方便监控区分
      minimum-idle: 5                    # 最小空闲连接数（低流量时保持5个）
      maximum-pool-size: 20              # 最大连接数（公式：CPU核数 * 2 + 磁盘数）
      idle-timeout: 300000               # 空闲连接超时：5分钟（毫秒）
      max-lifetime: 1800000              # 连接最大存活时间：30分钟（必须小于MySQL的wait_timeout）
      connection-timeout: 3000           # 获取连接超时：3秒（超过说明池不够用）
      connection-test-query: SELECT 1    # 连接有效性检测
      leak-detection-threshold: 60000    # 连接泄漏检测：60秒未归还则警告
```

> **为什么 `maximum-pool-size` 不要设太大？**
> 连接本身占内存，过多连接导致 MySQL 端线程切换开销剧增。一般 Web 应用 20-50 足够。
> 公式参考：`connections = (core_count * 2) + effective_spindle_count`

> ⚠️ `max-lifetime` 必须比 MySQL 的 `wait_timeout`（默认28800秒）短几分钟，否则应用拿到的连接可能已被 MySQL 端关闭。

### 2.3 MyBatis-Plus 集成

**Maven 依赖：**

```xml
<dependencies>
    <!-- MyBatis-Plus Starter（已内含 MyBatis） -->
    <dependency>
        <groupId>com.baomidou</groupId>
        <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
        <version>3.5.5</version>
    </dependency>

    <!-- MySQL 驱动 -->
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
        <scope>runtime</scope>
    </dependency>
</dependencies>
```

**MyBatis-Plus 配置：**

```yaml
# application.yml
mybatis-plus:
  mapper-locations: classpath*:/mapper/**/*.xml    # XML映射文件位置
  type-aliases-package: com.mall.entity            # 实体类包路径
  configuration:
    map-underscore-to-camel-case: true             # 下划线转驼峰（user_name → userName）
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl  # 开发环境打印SQL
  global-config:
    db-config:
      id-type: ASSIGN_ID                           # 雪花算法生成ID
      logic-delete-field: deleted                   # 全局逻辑删除字段
      logic-delete-value: 1
      logic-not-delete-value: 0
      table-prefix: t_                              # 表名前缀
```

**实体类：**

```java
@Data
@TableName("t_order")
public class Order {

    @TableId(type = IdType.ASSIGN_ID)   // 雪花ID，分布式环境不冲突
    private Long id;

    private Long userId;
    private String orderNo;
    private BigDecimal totalAmount;      // 金额必须用 BigDecimal
    private Integer status;              // 0-待支付 1-已支付 2-已发货 3-已完成 4-已取消

    @Version                             // 乐观锁字段
    private Integer version;

    @TableLogic                          // 逻辑删除
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
```

**Mapper 接口：**

```java
@Mapper
public interface OrderMapper extends BaseMapper<Order> {
    // BaseMapper 已提供：insert, deleteById, updateById, selectById,
    // selectList, selectPage, selectCount 等基础方法
    // 复杂查询写在 XML 里
}
```

**分页插件注册（必须配置，否则分页不生效）：**

```java
@Configuration
public class MybatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        // 分页插件（指定数据库类型）
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        // 乐观锁插件
        interceptor.addInnerInterceptor(new OptimisticLockerInnerInterceptor());
        // 防全表更新删除插件（生产环境强烈建议开启）
        interceptor.addInnerInterceptor(new BlockAttackInnerInterceptor());
        return interceptor;
    }
}
```

---

## 3. 库表设计最佳实践

### 3.1 命名规范

| 对象 | 规范 | 正例 | 反例 |
|------|------|------|------|
| 数据库 | 小写+下划线，业务前缀 | `mall_order` | `MallOrder`, `mall-order` |
| 表名 | 小写+下划线，加前缀 | `t_order_item` | `OrderItem`, `tbl_order` |
| 字段名 | 小写+下划线 | `user_name` | `userName`, `UserName` |
| 主键 | `id`（统一命名） | `id` | `order_id`（作为主键时） |
| 外键字段 | `关联表_id` | `user_id` | `uid`, `userId` |
| 普通索引 | `idx_表名_字段` | `idx_order_user_id` | `index1` |
| 唯一索引 | `uk_表名_字段` | `uk_user_phone` | `unique_phone` |
| 创建时间 | `create_time` | `create_time` | `created_at`, `gmt_create` |
| 更新时间 | `update_time` | `update_time` | `modified_at` |
| 逻辑删除 | `deleted` | `deleted` | `is_deleted`, `del_flag` |

### 3.2 字段类型选择指南

| 场景 | 推荐类型 | 不推荐 | 原因 |
|------|----------|--------|------|
| 主键 | `BIGINT UNSIGNED` | `INT` | INT 最大21亿，高并发系统很快用完 |
| 手机号 | `VARCHAR(20)` | `BIGINT` | 手机号可能有前导0、国际区号 |
| 金额 | `DECIMAL(12,2)` | `DOUBLE/FLOAT` | 浮点有精度丢失，0.1+0.2 != 0.3 |
| 状态/类型 | `TINYINT UNSIGNED` | `ENUM/VARCHAR` | ENUM 扩展困难，VARCHAR 浪费空间 |
| 短文本（名称） | `VARCHAR(64)` | `CHAR(64)` | VARCHAR 变长省空间，CHAR 定长会补空格 |
| 长文本（描述） | `TEXT` | `VARCHAR(10000)` | TEXT 不占用行内存储空间 |
| 时间戳 | `DATETIME` | `TIMESTAMP` | TIMESTAMP 只到2038年，且受时区影响 |
| 布尔值 | `TINYINT(1)` | `BIT/CHAR` | MyBatis 映射最方便 |
| IP 地址 | `INT UNSIGNED` + `INET_ATON()` | `VARCHAR(15)` | 整数占4字节，字符串占7-15字节 |
| JSON 数据 | `JSON` (MySQL 5.7+) | `TEXT` | JSON 类型支持内部字段查询和校验 |

> ⚠️ VARCHAR 的长度参数是**字符数**，不是字节数。`VARCHAR(255)` 在 utf8mb4 下最多占 1020 字节。超过 255 时长度前缀从 1 字节变为 2 字节。

### 3.3 索引设计原则

**该加索引的场景：**
- WHERE 条件中的高频查询字段
- JOIN 的关联字段
- ORDER BY / GROUP BY 字段
- 区分度高的字段（如 `order_no`，而非 `status`）

**不该加索引的场景：**
- 表数据量极小（几百条）
- 频繁更新的字段（索引维护成本高）
- 区分度极低的字段（如 `gender` 只有男/女）

**联合索引核心法则 -- 最左前缀原则：**

```
索引：idx_user_status_time (user_id, status, create_time)

能用到索引：
  WHERE user_id = 1                              ✅ 用到 user_id
  WHERE user_id = 1 AND status = 1               ✅ 用到 user_id + status
  WHERE user_id = 1 AND status = 1 AND create_time > '2024-01-01'  ✅ 全部用到
  WHERE user_id = 1 AND create_time > '2024-01-01'  ✅ 用到 user_id（跳过status）

用不到索引：
  WHERE status = 1                                ❌ 缺少最左列 user_id
  WHERE status = 1 AND create_time > '2024-01-01' ❌ 缺少最左列
```

**联合索引字段顺序原则：**
1. 等值查询字段放前面
2. 范围查询字段放后面
3. 区分度高的字段放前面（在不影响上述规则的前提下）

### 3.4 实战：电商订单表设计

```sql
CREATE TABLE `t_order` (
    `id`              BIGINT UNSIGNED  NOT NULL                COMMENT '主键ID（雪花算法）',
    `order_no`        VARCHAR(32)      NOT NULL                COMMENT '订单编号（业务唯一）',
    `user_id`         BIGINT UNSIGNED  NOT NULL                COMMENT '用户ID',
    `total_amount`    DECIMAL(12,2)    NOT NULL DEFAULT 0.00   COMMENT '订单总金额',
    `pay_amount`      DECIMAL(12,2)    NOT NULL DEFAULT 0.00   COMMENT '实付金额',
    `discount_amount` DECIMAL(12,2)    NOT NULL DEFAULT 0.00   COMMENT '优惠金额',
    `status`          TINYINT UNSIGNED NOT NULL DEFAULT 0      COMMENT '订单状态：0-待支付 1-已支付 2-已发货 3-已完成 4-已取消',
    `pay_type`        TINYINT UNSIGNED          DEFAULT NULL   COMMENT '支付方式：1-微信 2-支付宝 3-银行卡',
    `pay_time`        DATETIME                  DEFAULT NULL   COMMENT '支付时间',
    `deliver_time`    DATETIME                  DEFAULT NULL   COMMENT '发货时间',
    `receive_time`    DATETIME                  DEFAULT NULL   COMMENT '收货时间',
    `receiver_name`   VARCHAR(64)      NOT NULL                COMMENT '收货人姓名',
    `receiver_phone`  VARCHAR(20)      NOT NULL                COMMENT '收货人手机',
    `receiver_addr`   VARCHAR(256)     NOT NULL                COMMENT '收货地址',
    `remark`          VARCHAR(512)              DEFAULT ''     COMMENT '订单备注',
    `version`         INT UNSIGNED     NOT NULL DEFAULT 0      COMMENT '乐观锁版本号',
    `deleted`         TINYINT UNSIGNED NOT NULL DEFAULT 0      COMMENT '逻辑删除：0-未删除 1-已删除',
    `create_time`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_order_no` (`order_no`),
    KEY `idx_order_user_id` (`user_id`),
    KEY `idx_order_user_status` (`user_id`, `status`),
    KEY `idx_order_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单主表';
```

**设计要点说明：**

- `id` 用 `BIGINT UNSIGNED`：雪花 ID 是 Long 型，无符号可表示到 2^64-1
- `order_no` 加唯一索引：防止重复下单，也用于幂等校验
- 金额全部 `DECIMAL(12,2)`：精确到分，总位数12位支撑到百亿级别
- `status` 用 `TINYINT`：比 VARCHAR 节省空间，查询更快
- `DEFAULT CURRENT_TIMESTAMP`：数据库自动填充，不依赖应用层
- `ON UPDATE CURRENT_TIMESTAMP`：更新时自动刷新 update_time
- 每个字段都有 `COMMENT`：几个月后你会感谢自己

---

## 4. CRUD 企业级写法

### 4.1 批量插入

**方式一：MyBatis-Plus saveBatch（默认每批1000条）**

```java
@Service
public class OrderItemService extends ServiceImpl<OrderItemMapper, OrderItem> {

    public void batchInsertItems(List<OrderItem> items) {
        // saveBatch 底层分批执行，默认每批1000条
        // 内部用 SqlSession 的 flushStatements 实现批量
        this.saveBatch(items, 500);  // 第二个参数控制每批大小
    }
}
```

> ⚠️ `saveBatch` 并不是真正的批量 INSERT，而是循环单条 INSERT + 分批提交。性能优于逐条插入，但不如原生批量 INSERT。

**方式二：XML 拼接 VALUES（真正的批量 INSERT）**

```xml
<!-- OrderItemMapper.xml -->
<insert id="batchInsert">
    INSERT INTO t_order_item (id, order_id, sku_id, sku_name, quantity, price)
    VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.id}, #{item.orderId}, #{item.skuId}, #{item.skuName}, #{item.quantity}, #{item.price})
    </foreach>
</insert>
```

```java
@Mapper
public interface OrderItemMapper extends BaseMapper<OrderItem> {
    void batchInsert(@Param("list") List<OrderItem> list);
}
```

> ⚠️ 这种方式单次不要超过 5000 条。SQL 太长会超出 `max_allowed_packet`（默认 4MB）。大批量数据应在应用层分批调用。

**方式三：JDBC Batch + rewriteBatchedStatements（性能最佳）**

```
# JDBC URL 必须加此参数，否则 addBatch 不会真正合并
jdbc:mysql://localhost:3306/mall?rewriteBatchedStatements=true
```

```java
@Repository
public class OrderItemBatchDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public void batchInsert(List<OrderItem> items) {
        String sql = "INSERT INTO t_order_item (id, order_id, sku_id, quantity, price) VALUES (?, ?, ?, ?, ?)";

        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                OrderItem item = items.get(i);
                ps.setLong(1, item.getId());
                ps.setLong(2, item.getOrderId());
                ps.setLong(3, item.getSkuId());
                ps.setInt(4, item.getQuantity());
                ps.setBigDecimal(5, item.getPrice());
            }
            @Override
            public int getBatchSize() {
                return items.size();
            }
        });
    }
}
```

**三种方式性能对比（插入10000条）：**

| 方式 | 耗时 | 说明 |
|------|------|------|
| 逐条 INSERT | ~12s | 每条都是独立的网络往返 |
| saveBatch(1000) | ~3s | 分批提交，减少事务次数 |
| XML foreach | ~0.8s | 单条 SQL 多 VALUES |
| JDBC Batch + rewrite | ~0.5s | 驱动层合并，性能最佳 |

### 4.2 分页查询

**基础分页（MyBatis-Plus）：**

```java
@Service
public class OrderService {

    @Autowired
    private OrderMapper orderMapper;

    public IPage<Order> pageOrders(Integer pageNum, Integer pageSize, Long userId) {
        Page<Order> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<Order>()
                .eq(Order::getUserId, userId)
                .eq(Order::getDeleted, 0)
                .orderByDesc(Order::getCreateTime);
        return orderMapper.selectPage(page, wrapper);
    }
}
```

**深分页问题：**

```sql
-- 当 offset 很大时（比如第10000页），MySQL 需要扫描并丢弃前面 99990 条
SELECT * FROM t_order ORDER BY create_time DESC LIMIT 99990, 10;
-- 实际扫描了 100000 行，只返回 10 行，极度浪费
```

**解决方案一：游标分页（推荐用于滚动加载场景）**

```java
/**
 * 游标分页：基于上一页最后一条记录的ID继续查询
 * 适用于"加载更多"、无限滚动，不支持跳页
 */
public List<Order> cursorPage(Long lastId, Integer pageSize, Long userId) {
    LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<Order>()
            .eq(Order::getUserId, userId)
            .eq(Order::getDeleted, 0);

    if (lastId != null) {
        // 利用主键有序性，直接从上次位置继续
        wrapper.lt(Order::getId, lastId);
    }

    wrapper.orderByDesc(Order::getId)
           .last("LIMIT " + pageSize);

    return orderMapper.selectList(wrapper);
}
```

生成的 SQL：

```sql
-- 无论翻到多深，都只扫描 pageSize 行
SELECT * FROM t_order
WHERE user_id = 1001 AND deleted = 0 AND id < 1234567890
ORDER BY id DESC LIMIT 10;
```

**解决方案二：子查询延迟关联（支持跳页）**

```xml
<!-- 先用覆盖索引定位ID，再回表取数据 -->
<select id="pageBySubQuery" resultType="Order">
    SELECT o.* FROM t_order o
    INNER JOIN (
        SELECT id FROM t_order
        WHERE user_id = #{userId} AND deleted = 0
        ORDER BY create_time DESC
        LIMIT #{offset}, #{pageSize}
    ) tmp ON o.id = tmp.id
</select>
```

### 4.3 乐观锁与悲观锁

**乐观锁（MyBatis-Plus 内置支持）：**

适用于冲突概率低的场景，通过 version 字段实现。

```java
// 实体类加 @Version 注解（前面已配置），使用时：
public boolean updateOrderStatus(Long orderId, Integer newStatus) {
    Order order = orderMapper.selectById(orderId);
    // 此时 order.version = 1

    order.setStatus(newStatus);
    // MyBatis-Plus 自动生成：
    // UPDATE t_order SET status=2, version=2 WHERE id=xxx AND version=1
    int rows = orderMapper.updateById(order);

    if (rows == 0) {
        // version 不匹配，说明被其他线程修改过
        throw new OptimisticLockException("订单已被修改，请刷新重试");
    }
    return true;
}
```

**悲观锁（SELECT ... FOR UPDATE）：**

适用于冲突概率高的场景，如库存扣减。

```xml
<!-- StockMapper.xml -->
<select id="selectForUpdate" resultType="Stock">
    SELECT id, sku_id, quantity
    FROM t_stock
    WHERE sku_id = #{skuId}
    FOR UPDATE
</select>
```

```java
@Service
public class StockService {

    @Transactional(rollbackFor = Exception.class)
    public void deductStock(Long skuId, Integer count) {
        // FOR UPDATE 锁住这行，其他事务读这行时阻塞
        Stock stock = stockMapper.selectForUpdate(skuId);

        if (stock.getQuantity() < count) {
            throw new BusinessException("库存不足");
        }

        stock.setQuantity(stock.getQuantity() - count);
        stockMapper.updateById(stock);
        // 事务提交时释放行锁
    }
}
```

> ⚠️ 悲观锁必须在事务内使用，且事务要尽可能短。长事务 + FOR UPDATE 会导致大量线程阻塞等待。

**选型建议：**

| 维度 | 乐观锁 | 悲观锁 |
|------|--------|--------|
| 冲突频率 | 低（读多写少） | 高（写竞争激烈） |
| 性能 | 高（无锁等待） | 低（有锁等待） |
| 实现复杂度 | 简单（version字段） | 需要注意死锁 |
| 典型场景 | 修改用户信息、更新配置 | 扣减库存、抢购 |
| 失败处理 | 应用层重试 | 数据库层排队 |

### 4.4 事务管理

**基本用法：**

```java
@Service
public class OrderService {

    @Transactional(rollbackFor = Exception.class)  // 必须指定 rollbackFor
    public void createOrder(OrderCreateDTO dto) {
        // 1. 扣减库存
        stockService.deductStock(dto.getSkuId(), dto.getQuantity());
        // 2. 创建订单
        Order order = buildOrder(dto);
        orderMapper.insert(order);
        // 3. 创建订单项
        OrderItem item = buildOrderItem(order, dto);
        orderItemMapper.insert(item);
        // 任何一步抛异常，全部回滚
    }
}
```

> ⚠️ **@Transactional 的六大坑：**

**坑1：不指定 rollbackFor**

```java
// 错误：默认只回滚 RuntimeException，IOException 等检查异常不回滚
@Transactional
public void doSomething() throws IOException { ... }

// 正确：
@Transactional(rollbackFor = Exception.class)
```

**坑2：方法不是 public**

```java
// 错误：Spring AOP 代理只拦截 public 方法
@Transactional(rollbackFor = Exception.class)
private void doSomething() { ... }  // 事务不生效
```

**坑3：自调用（同一个类内部调用）**

```java
@Service
public class OrderService {

    public void createOrder(OrderCreateDTO dto) {
        // 错误：内部调用不经过代理，事务不生效
        this.doCreate(dto);
    }

    @Transactional(rollbackFor = Exception.class)
    public void doCreate(OrderCreateDTO dto) { ... }
}

// 正确方案一：注入自己
@Service
public class OrderService {
    @Autowired
    private OrderService self;  // 注入代理对象

    public void createOrder(OrderCreateDTO dto) {
        self.doCreate(dto);  // 通过代理调用
    }
}

// 正确方案二：拆分到不同的 Service
```

**坑4：异常被 catch 吞掉**

```java
@Transactional(rollbackFor = Exception.class)
public void createOrder(OrderCreateDTO dto) {
    try {
        orderMapper.insert(order);
        stockService.deductStock(dto.getSkuId(), 1);
    } catch (Exception e) {
        log.error("下单失败", e);
        // 错误：异常被捕获，Spring 感知不到，事务不回滚
    }
}

// 正确：catch 后重新抛出，或者手动回滚
// 方案一：重新抛出
catch (Exception e) {
    log.error("下单失败", e);
    throw e;
}
// 方案二：手动回滚
catch (Exception e) {
    log.error("下单失败", e);
    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
}
```

**坑5：传播级别使用不当**

```java
// 场景：下单后发送通知，通知失败不应回滚订单
@Transactional(rollbackFor = Exception.class)
public void createOrder(OrderCreateDTO dto) {
    orderMapper.insert(order);

    // 通知方法开启独立事务，失败不影响主事务
    notifyService.sendOrderNotification(order);
}

@Service
public class NotifyService {
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void sendOrderNotification(Order order) {
        // 独立事务，这里异常不会导致订单回滚
    }
}
```

**常用传播级别：**

| 传播级别 | 说明 | 场景 |
|----------|------|------|
| `REQUIRED`（默认） | 有事务就加入，没有就新建 | 绝大多数业务方法 |
| `REQUIRES_NEW` | 总是新建事务，挂起当前事务 | 日志记录、通知发送 |
| `NOT_SUPPORTED` | 以非事务方式执行，挂起当前事务 | 查询密集型操作 |
| `NESTED` | 嵌套事务（savepoint），外层回滚则一起回滚 | 批量操作中的单条处理 |

**坑6：长事务**

```java
// 错误：事务内做远程调用，事务持有时间过长
@Transactional(rollbackFor = Exception.class)
public void createOrder(OrderCreateDTO dto) {
    orderMapper.insert(order);
    // HTTP 调用可能耗时数秒，期间一直持有事务和数据库连接
    paymentClient.createPayment(order);   // 远程调用不要放在事务内
    stockService.deductStock(dto.getSkuId(), 1);
}

// 正确：缩小事务范围
public void createOrder(OrderCreateDTO dto) {
    // 非事务操作
    PaymentResult result = paymentClient.createPayment(order);

    // 事务操作
    doCreateOrder(dto, result);
}

@Transactional(rollbackFor = Exception.class)
public void doCreateOrder(OrderCreateDTO dto, PaymentResult result) {
    orderMapper.insert(order);
    stockService.deductStock(dto.getSkuId(), 1);
}
```

### 4.5 逻辑删除

MyBatis-Plus 全局配置后（见 2.3 节），所有查询自动追加 `WHERE deleted = 0`。

```java
// 逻辑删除
orderMapper.deleteById(orderId);
// 实际执行：UPDATE t_order SET deleted = 1 WHERE id = xxx AND deleted = 0

// 查询自动过滤
orderMapper.selectList(null);
// 实际执行：SELECT * FROM t_order WHERE deleted = 0

// 如果确实需要查已删除数据，用原生 SQL 或 Wrapper 忽略
```

> ⚠️ 逻辑删除后，唯一索引会冲突。解决方案：唯一索引包含 `deleted` 字段，或使用 `deleted` 存储删除时间戳（0表示未删除）。

```sql
-- 方案：deleted 字段存 0 或 删除时间戳
-- 唯一索引改为 (phone, deleted)
-- 未删除：phone='13800001111', deleted=0
-- 删除后：phone='13800001111', deleted=1704067200（时间戳，每次不同）
-- 再注册：phone='13800001111', deleted=0  → 不冲突
```

---

## 5. 主流配置与调优

### 5.1 关键 MySQL 参数

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `innodb_buffer_pool_size` | 物理内存的 60%-70% | InnoDB 核心缓存，缓存数据页和索引页。8G 内存的服务器设 5G |
| `innodb_buffer_pool_instances` | 8 | buffer pool 分片数，减少并发争用。pool_size >= 1G 时生效 |
| `innodb_log_file_size` | 256M - 1G | redo log 大小。太小导致频繁刷盘，太大导致崩溃恢复慢 |
| `innodb_flush_log_at_trx_commit` | 1 | 1=每次提交刷盘（最安全）；2=每秒刷盘（性能好但可能丢1秒数据） |
| `innodb_flush_method` | O_DIRECT | 绕过 OS 缓存直接写磁盘，避免双重缓存 |
| `max_connections` | 500-1000 | 最大连接数。所有应用实例的连接池之和不应超过此值 |
| `max_allowed_packet` | 64M | 单个 SQL 最大包大小。批量插入大数据时可能需要调大 |
| `sort_buffer_size` | 2M | 排序缓冲区，每个连接独占。设太大会浪费内存 |
| `join_buffer_size` | 2M | JOIN 缓冲区，同上 |
| `tmp_table_size` | 64M | 内存临时表最大值。超过此值会落盘 |
| `max_tmp_tables` | 64 | 最大临时表数量 |
| `thread_cache_size` | 64 | 线程缓存大小。减少线程创建销毁开销 |
| `wait_timeout` | 600 | 空闲连接超时（秒）。比应用连接池的 max-lifetime 大 |
| `interactive_timeout` | 600 | 交互式连接超时 |

**配置示例（8核16G生产服务器）：**

```ini
[mysqld]
# 缓存
innodb_buffer_pool_size = 10G
innodb_buffer_pool_instances = 8
innodb_log_file_size = 512M

# 刷盘策略
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1
innodb_flush_method = O_DIRECT

# 连接
max_connections = 800
thread_cache_size = 64
wait_timeout = 600

# 临时表和排序
tmp_table_size = 64M
max_heap_table_size = 64M
sort_buffer_size = 2M
join_buffer_size = 2M

# 日志
slow_query_log = ON
long_query_time = 1
log_queries_not_using_indexes = ON
```

### 5.2 慢查询日志

**开启慢查询日志：**

```sql
-- 动态开启（重启失效，永久生效需写入配置文件）
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;                    -- 超过1秒的SQL记录
SET GLOBAL log_queries_not_using_indexes = ON;     -- 未使用索引的SQL也记录
SET GLOBAL slow_query_log_file = '/var/lib/mysql/slow.log';
```

**分析慢查询日志：**

```bash
# 使用 mysqldumpslow 工具（MySQL自带）
# 按执行时间排序，取 Top 10
mysqldumpslow -s t -t 10 /var/lib/mysql/slow.log

# 按出现次数排序
mysqldumpslow -s c -t 10 /var/lib/mysql/slow.log

# 输出示例：
# Count: 125  Time=3.21s (401s)  Lock=0.00s (0s)  Rows=10.0 (1250)
# SELECT * FROM t_order WHERE user_id = N ORDER BY create_time DESC LIMIT N, N
```

### 5.3 EXPLAIN 执行计划详解

```sql
EXPLAIN SELECT * FROM t_order
WHERE user_id = 1001 AND status = 1
ORDER BY create_time DESC
LIMIT 10;
```

**EXPLAIN 各字段含义：**

| 字段 | 含义 | 关键值说明 |
|------|------|-----------|
| `id` | 查询序号 | 值越大越先执行；相同则从上往下执行 |
| `select_type` | 查询类型 | `SIMPLE`=简单查询；`PRIMARY`=外层查询；`SUBQUERY`=子查询；`DERIVED`=派生表 |
| `table` | 访问的表 | 有可能是派生表别名 |
| `partitions` | 命中分区 | 无分区时为 NULL |
| `type` | **访问类型（最重要）** | 性能从好到差：`system` > `const` > `eq_ref` > `ref` > `range` > `index` > `ALL` |
| `possible_keys` | 可能使用的索引 | 不代表实际使用 |
| `key` | **实际使用的索引** | NULL 表示未使用索引 |
| `key_len` | 索引使用的字节长度 | 越短说明使用的索引字段越少 |
| `ref` | 索引查找使用的列或常量 | `const` 表示常量值匹配 |
| `rows` | **预估扫描行数** | 越小越好 |
| `filtered` | 过滤后的比例 | 100% 表示所有行都匹配 |
| `Extra` | **额外信息** | 见下表 |

**Extra 字段常见值：**

| Extra 值 | 含义 | 是否需要优化 |
|----------|------|-------------|
| `Using index` | 覆盖索引，不需要回表 | 很好，无需优化 |
| `Using where` | 在存储引擎层过滤后，Server 层再过滤 | 正常 |
| `Using index condition` | 索引下推（ICP），在存储引擎层用索引过滤 | 较好 |
| `Using temporary` | 使用了临时表 | 需要关注，考虑优化 |
| `Using filesort` | 额外排序操作 | 需要关注，考虑添加排序索引 |
| `Using join buffer` | JOIN 使用了缓冲区（通常是 BNL 或 Hash Join） | 关联字段需要加索引 |
| `Select tables optimized away` | 查询优化器直接从索引获取结果 | 完美 |

**type 字段详解（面试高频）：**

| type | 含义 | 示例 | 是否可接受 |
|------|------|------|-----------|
| `system` | 表只有一行 | 系统表 | 完美 |
| `const` | 主键或唯一索引等值查询 | `WHERE id = 1` | 完美 |
| `eq_ref` | JOIN 时被驱动表通过主键/唯一索引匹配 | 主键关联 | 很好 |
| `ref` | 非唯一索引等值查询 | `WHERE user_id = 1001` | 好 |
| `range` | 索引范围扫描 | `WHERE id > 100 AND id < 200` | 可接受 |
| `index` | 全索引扫描（遍历索引树） | 索引覆盖但无 WHERE | 需关注 |
| `ALL` | **全表扫描** | 无索引命中 | 必须优化 |

> ⚠️ 生产环境中，`type` 至少达到 `range` 级别。出现 `ALL` 则必须优化。

### 5.4 索引优化工作流

```
发现慢查询
   │
   ▼
查看慢查询日志或 APM 监控
   │
   ▼
EXPLAIN 分析执行计划
   │
   ├── type = ALL？ → 缺少索引，添加合适的索引
   │
   ├── key = NULL？ → 索引未命中，检查：
   │       ├── 字段上有索引吗？
   │       ├── 是否隐式类型转换？（见第6章）
   │       ├── 是否对索引字段用了函数？
   │       └── 联合索引是否违反最左前缀？
   │
   ├── rows 很大？ → 考虑：
   │       ├── 优化 WHERE 条件缩小范围
   │       ├── 添加更精确的联合索引
   │       └── 改为覆盖索引避免回表
   │
   ├── Extra = Using filesort？ → 排序字段加入索引
   │
   └── Extra = Using temporary？ → GROUP BY 字段加入索引
   │
   ▼
添加或调整索引 → 重新 EXPLAIN 验证
   │
   ▼
上线后持续监控慢查询日志
```

**实操示例：**

```sql
-- 原始慢查询（2.3秒）
SELECT * FROM t_order WHERE user_id = 1001 AND status = 1 ORDER BY create_time DESC LIMIT 10;

-- EXPLAIN 结果：type=ALL, rows=500000, Extra=Using where; Using filesort

-- 第一步：添加联合索引
ALTER TABLE t_order ADD INDEX idx_order_uid_status_ctime (user_id, status, create_time);

-- 再次 EXPLAIN：type=ref, rows=120, Extra=Using index condition; Backward index scan
-- 查询时间从 2.3秒 → 0.003秒
```

---

## 6. 常见陷阱（踩坑指南）

### 6.1 隐式类型转换导致索引失效

```sql
-- t_order 表 order_no 字段类型为 VARCHAR(32)，有索引 uk_order_order_no

-- 错误：传入数字，MySQL 将 order_no 转为数字再比较，索引失效
SELECT * FROM t_order WHERE order_no = 20240101001;
-- EXPLAIN: type=ALL（全表扫描）

-- 正确：传入字符串
SELECT * FROM t_order WHERE order_no = '20240101001';
-- EXPLAIN: type=const（索引命中）
```

**在 Java 中的体现：**

```java
// 错误：MyBatis 参数类型不匹配
// 假设 orderNo 定义为 Long 但数据库是 VARCHAR
@Select("SELECT * FROM t_order WHERE order_no = #{orderNo}")
Order selectByOrderNo(@Param("orderNo") Long orderNo);
// 实际SQL：WHERE order_no = 20240101001  → 索引失效

// 正确：参数类型和数据库字段类型一致
@Select("SELECT * FROM t_order WHERE order_no = #{orderNo}")
Order selectByOrderNo(@Param("orderNo") String orderNo);
```

**隐式转换规则记忆口诀：字符串列比数字，索引必定会失效。**

### 6.2 大事务阻塞

```java
// 错误示例：事务中包含耗时操作
@Transactional(rollbackFor = Exception.class)
public void importOrders(List<OrderDTO> dtoList) {
    for (OrderDTO dto : dtoList) {
        // 循环10万次，每次都是事务内操作
        Order order = convertToOrder(dto);
        orderMapper.insert(order);
        // 远程调用验证地址（每次耗时200ms）
        addressService.validate(order.getReceiverAddr());
    }
    // 整个事务持续数小时，锁住大量行
    // 其他用户查询订单可能被阻塞
}

// 正确：分批处理 + 缩小事务范围
public void importOrders(List<OrderDTO> dtoList) {
    // 按500条分批
    List<List<OrderDTO>> batches = Lists.partition(dtoList, 500);
    for (List<OrderDTO> batch : batches) {
        // 先做远程调用（事务外）
        batch.forEach(dto -> addressService.validate(dto.getReceiverAddr()));
        // 再批量入库（事务内，快速完成）
        orderService.batchInsert(batch);
    }
}

@Transactional(rollbackFor = Exception.class)
public void batchInsert(List<OrderDTO> batch) {
    List<Order> orders = batch.stream().map(this::convertToOrder).toList();
    orderItemMapper.batchInsert(orders);
}
```

### 6.3 深分页性能问题

已在 4.2 节详细说明。核心结论：

```
LIMIT 100000, 10  →  扫描100010行，丢弃100000行
解决方案：游标分页或延迟关联子查询
```

### 6.4 NULL 比较陷阱

```sql
-- 以下三个查询结果可能不符合预期
SELECT * FROM t_user WHERE name = NULL;     -- 永远返回空（应该用 IS NULL）
SELECT * FROM t_user WHERE name != '张三';   -- 不包含 name 为 NULL 的行
SELECT * FROM t_user WHERE name NOT IN ('张三', '李四');  -- 不包含 NULL 行

-- 正确写法
SELECT * FROM t_user WHERE name IS NULL;
SELECT * FROM t_user WHERE name != '张三' OR name IS NULL;
SELECT * FROM t_user WHERE (name NOT IN ('张三', '李四') OR name IS NULL);
```

**Java 层面的防御：**

```java
// MyBatis-Plus 查询时注意 NULL 处理
LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
        // 条件不为null时才追加查询条件
        .eq(StringUtils.isNotBlank(name), User::getName, name)
        // 查询 name 为空的记录
        .isNull(User::getName);
```

> ⚠️ 建议：表设计时字段尽量 `NOT NULL DEFAULT ''` 或 `NOT NULL DEFAULT 0`，从源头避免 NULL 问题。NULL 还会导致索引统计不准确。

### 6.5 UTF8 vs UTF8MB4

```
MySQL 的 utf8 实际上是 utf8mb3，最多3字节，不能存储 emoji 表情符号（4字节）。
utf8mb4 才是真正的 UTF-8。
```

```sql
-- 错误：使用 utf8，存储 emoji 会报错
CREATE TABLE t_comment (
    content VARCHAR(500)
) CHARSET=utf8;
-- INSERT INTO t_comment (content) VALUES ('好评 😊');
-- 报错：Incorrect string value: '\xF0\x9F\x98\x8A'

-- 正确：使用 utf8mb4
CREATE TABLE t_comment (
    content VARCHAR(500)
) CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> ⚠️ 建议：所有新项目一律使用 `utf8mb4`。排序规则用 `utf8mb4_unicode_ci`（不区分大小写）或 `utf8mb4_bin`（区分大小写）。

### 6.6 SELECT * 的问题

```sql
-- 错误：SELECT *
SELECT * FROM t_order WHERE user_id = 1001;
```

**问题清单：**

1. **无法使用覆盖索引**：如果索引已包含需要的字段，SELECT * 强制回表
2. **网络带宽浪费**：大字段（TEXT/BLOB）即使用不到也会传输
3. **内存浪费**：ResultSet 占用更多内存
4. **代码可维护性差**：表结构变更可能导致应用出错

```java
// 正确：只查需要的字段
LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<Order>()
        .select(Order::getId, Order::getOrderNo, Order::getStatus, Order::getTotalAmount)
        .eq(Order::getUserId, userId);
List<Order> orders = orderMapper.selectList(wrapper);
```

### 6.7 连接池配置不当

```
场景：未使用连接池或配置错误，导致以下问题：
```

| 问题 | 原因 | 解决 |
|------|------|------|
| 每次请求创建新连接 | 未配置连接池 | 使用 HikariCP |
| `Too many connections` | maximum-pool-size 过大或有连接泄漏 | 调小连接池 + 开启泄漏检测 |
| `Connection is not available` | 连接池太小，请求并发超过池大小 | 适当增大 maximum-pool-size |
| 连接偶尔报错 | max-lifetime 大于 MySQL wait_timeout | 调小 max-lifetime |
| 应用启动慢 | minimum-idle 设太大 | 按实际最低并发设置 |

```yaml
# 正确配置参照（2.2 节的完整配置）
# 核心原则：
#   maximum-pool-size = CPU核数 * 2 + 磁盘数 ≈ 20
#   max-lifetime < MySQL wait_timeout
#   开启 leak-detection-threshold
```

---

## 7. 与其他技术的配合

### 7.1 MySQL + Redis 缓存一致性

**Cache Aside 模式（最常用）：**

```
读取流程：
   ┌──────────┐     命中     ┌──────────┐
   │  应用层   │ ──────────→ │  Redis   │ → 返回数据
   └──────────┘     未命中    └──────────┘
        │
        ▼
   ┌──────────┐
   │  MySQL   │ → 查到数据 → 写入 Redis → 返回数据
   └──────────┘

更新流程：
   ┌──────────┐     ①更新     ┌──────────┐
   │  应用层   │ ──────────→ │  MySQL   │
   └──────────┘              └──────────┘
        │
        │  ②删除缓存
        ▼
   ┌──────────┐
   │  Redis   │
   └──────────┘
```

> ⚠️ 先更新数据库，再删除缓存。不要先删缓存再更新数据库（会导致缓存和数据库不一致）。

**Java 实现：**

```java
@Service
public class ProductService {

    @Autowired
    private ProductMapper productMapper;
    @Autowired
    private StringRedisTemplate redisTemplate;

    private static final String PRODUCT_KEY_PREFIX = "product:";
    private static final long CACHE_TTL = 30;  // 分钟

    // 读取：Cache Aside
    public Product getProduct(Long productId) {
        String key = PRODUCT_KEY_PREFIX + productId;

        // 1. 查缓存
        String json = redisTemplate.opsForValue().get(key);
        if (StringUtils.isNotBlank(json)) {
            // 缓存命中
            return JSON.parseObject(json, Product.class);
        }

        // 2. 缓存未命中，查数据库
        Product product = productMapper.selectById(productId);
        if (product == null) {
            // 防缓存穿透：空值也缓存，TTL 短一些
            redisTemplate.opsForValue().set(key, "", 5, TimeUnit.MINUTES);
            return null;
        }

        // 3. 写入缓存（加随机TTL防雪崩）
        long ttl = CACHE_TTL + ThreadLocalRandom.current().nextInt(10);
        redisTemplate.opsForValue().set(key, JSON.toJSONString(product), ttl, TimeUnit.MINUTES);
        return product;
    }

    // 更新：先更新DB，再删缓存
    @Transactional(rollbackFor = Exception.class)
    public void updateProduct(Product product) {
        // 1. 更新数据库
        productMapper.updateById(product);
        // 2. 删除缓存
        String key = PRODUCT_KEY_PREFIX + product.getId();
        redisTemplate.delete(key);
    }
}
```

**延迟双删（解决极端并发不一致）：**

```java
public void updateProduct(Product product) {
    String key = PRODUCT_KEY_PREFIX + product.getId();

    // 1. 删除缓存
    redisTemplate.delete(key);

    // 2. 更新数据库
    productMapper.updateById(product);

    // 3. 延迟再删一次（覆盖并发读导致的脏缓存）
    // 延迟时间 > 一次读请求的耗时（通常500ms-1s）
    CompletableFuture.runAsync(() -> {
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        redisTemplate.delete(key);
    });
}
```

> 延迟双删的本质是：在数据库主从同步完成、且并发读请求结束后，再删一次可能被污染的缓存。适用于对一致性要求较高但不需要强一致的场景。

### 7.2 MySQL + MQ 异步写入

**场景：下单后需要发短信、推送、积分计算等操作，不应阻塞主流程。**

```
同步写法（错误）：
创建订单 → 扣库存 → 发短信 → 推送 → 加积分 → 返回（总耗时 2s+）

异步写法（正确）：
创建订单 → 扣库存 → 发MQ消息 → 返回（总耗时 200ms）
                         │
                         ▼
                    消费者异步处理：
                    ├── 发短信
                    ├── 推送
                    └── 加积分
```

```java
@Service
public class OrderService {

    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private StockService stockService;
    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    @Transactional(rollbackFor = Exception.class)
    public Order createOrder(OrderCreateDTO dto) {
        // 1. 核心操作在事务内完成
        stockService.deductStock(dto.getSkuId(), dto.getQuantity());
        Order order = buildOrder(dto);
        orderMapper.insert(order);

        // 2. 事务提交后发送MQ（使用事务消息或TransactionSynchronization）
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    // 事务提交成功后才发消息，避免数据库回滚但消息已发出
                    rocketMQTemplate.convertAndSend("order-created-topic",
                        JSON.toJSONString(new OrderCreatedEvent(order.getId(), order.getOrderNo())));
                }
            }
        );

        return order;
    }
}

// 消费者
@Component
@RocketMQMessageListener(topic = "order-created-topic", consumerGroup = "order-notify-group")
public class OrderCreatedConsumer implements RocketMQListener<String> {

    @Override
    public void onMessage(String message) {
        OrderCreatedEvent event = JSON.parseObject(message, OrderCreatedEvent.class);
        // 发短信、推送、加积分（各自独立，失败可重试）
        smsService.sendOrderNotification(event.getOrderNo());
        pushService.pushOrderCreated(event.getUserId());
        pointsService.addPoints(event.getUserId(), event.getAmount());
    }
}
```

> ⚠️ 关键点：必须在事务提交后再发消息。如果事务回滚了但消息已发出，消费者处理的是不存在的订单。使用 `TransactionSynchronizationManager.registerSynchronization` 或 RocketMQ 事务消息来保证。

### 7.3 读写分离

**方案一：Spring AbstractRoutingDataSource（轻量级）**

```java
// 1. 定义数据源类型枚举
public enum DataSourceType {
    MASTER, SLAVE
}

// 2. 线程级数据源上下文
public class DataSourceContextHolder {
    private static final ThreadLocal<DataSourceType> CONTEXT = new ThreadLocal<>();

    public static void setType(DataSourceType type) { CONTEXT.set(type); }
    public static DataSourceType getType() { return CONTEXT.get(); }
    public static void clear() { CONTEXT.remove(); }
}

// 3. 动态数据源
public class DynamicDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return DataSourceContextHolder.getType();
    }
}

// 4. 自定义注解
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ReadOnly {
}

// 5. AOP 切面自动切换
@Aspect
@Component
@Order(-1)  // 必须在 @Transactional 之前执行
public class DataSourceAspect {

    @Around("@annotation(readOnly)")
    public Object switchDataSource(ProceedingJoinPoint point, ReadOnly readOnly) throws Throwable {
        try {
            DataSourceContextHolder.setType(DataSourceType.SLAVE);
            return point.proceed();
        } finally {
            DataSourceContextHolder.clear();
        }
    }
}

// 6. 使用
@Service
public class ProductService {

    @ReadOnly  // 读操作走从库
    public Product getProduct(Long id) {
        return productMapper.selectById(id);
    }

    @Transactional(rollbackFor = Exception.class)  // 写操作走主库（默认）
    public void updateProduct(Product product) {
        productMapper.updateById(product);
    }
}
```

**方案二：ShardingSphere-JDBC（推荐生产使用）**

```yaml
# application.yml
spring:
  shardingsphere:
    datasource:
      names: master,slave0,slave1
      master:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://master-host:3306/mall?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: app_user
        password: Master@2024
        hikari:
          maximum-pool-size: 20
      slave0:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://slave0-host:3306/mall?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: readonly_user
        password: Slave@2024
        hikari:
          maximum-pool-size: 20
      slave1:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://slave1-host:3306/mall?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: readonly_user
        password: Slave@2024
        hikari:
          maximum-pool-size: 20
    rules:
      readwrite-splitting:
        data-sources:
          readwrite_ds:
            static-strategy:
              write-data-source-name: master
              read-data-source-names: slave0,slave1
            load-balancer-name: round_robin
        load-balancers:
          round_robin:
            type: ROUND_ROBIN   # 从库轮询负载
    props:
      sql-show: true            # 开发环境打印实际路由的SQL
```

```xml
<!-- Maven 依赖 -->
<dependency>
    <groupId>org.apache.shardingsphere</groupId>
    <artifactId>shardingsphere-jdbc-core</artifactId>
    <version>5.4.1</version>
</dependency>
```

> ShardingSphere 的优势：自动识别读写操作进行路由，事务内的读操作自动走主库（避免主从延迟导致的数据不一致），支持多从库负载均衡，对应用代码完全透明。

**读写分离的注意事项：**

| 注意点 | 说明 |
|--------|------|
| 主从延迟 | 主库写入后立即读从库可能读不到。关键业务读操作强制走主库 |
| 事务内读写 | 事务内的所有操作必须走同一个数据源（主库） |
| 从库故障 | 需要健康检查机制，自动剔除不可用从库 |
| 数据一致性 | 对一致性要求高的查询（如支付后查订单状态），必须读主库 |

```java
// ShardingSphere 强制走主库的方式
@Service
public class OrderService {

    public Order getOrderAfterPay(Long orderId) {
        // 使用 HintManager 强制路由到主库
        try (HintManager hintManager = HintManager.getInstance()) {
            hintManager.setWriteRouteOnly();  // 强制走主库
            return orderMapper.selectById(orderId);
        }
    }
}
```

### 7.4 MySQL + Elasticsearch 搜索方案

**场景：商品搜索需要全文检索、分词、高亮、多维度筛选，MySQL LIKE 查询无法满足。**

**架构设计：**

```
数据写入流程：
  应用 → MySQL（数据主存储） → Canal 监听 binlog → Kafka → ES 同步消费者 → Elasticsearch

数据查询流程：
  搜索请求 → Elasticsearch（返回商品ID列表）
  详情请求 → MySQL（根据ID查完整数据）
```

**Canal 同步方案（推荐）：**

```java
// Canal 消费者监听 MySQL binlog 变更，同步到 ES
@Component
@CanalEventListener
public class ProductCanalListener {

    @Autowired
    private ElasticsearchRestTemplate esTemplate;
    @Autowired
    private ProductMapper productMapper;

    @ListenPoint(table = "t_product")
    public void onProductChange(CanalEntry.EventType eventType, CanalEntry.RowData rowData) {
        // 获取变更后的数据
        Map<String, String> afterMap = new HashMap<>();
        rowData.getAfterColumnsList().forEach(col -> afterMap.put(col.getName(), col.getValue()));

        Long productId = Long.parseLong(afterMap.get("id"));

        switch (eventType) {
            case INSERT:
            case UPDATE:
                // 从 MySQL 查完整数据，构建 ES 文档
                Product product = productMapper.selectById(productId);
                if (product != null) {
                    ProductDoc doc = convertToDoc(product);
                    esTemplate.save(doc);
                }
                break;
            case DELETE:
                esTemplate.delete(String.valueOf(productId), ProductDoc.class);
                break;
        }
    }
}
```

**ES 文档定义：**

```java
@Document(indexName = "product")
@Setting(shards = 3, replicas = 1)
public class ProductDoc {

    @Id
    private Long id;

    @Field(type = FieldType.Text, analyzer = "ik_max_word", searchAnalyzer = "ik_smart")
    private String name;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String description;

    @Field(type = FieldType.Keyword)          // 精确匹配，不分词
    private String categoryCode;

    @Field(type = FieldType.Keyword)
    private String brandName;

    @Field(type = FieldType.Double)
    private BigDecimal price;

    @Field(type = FieldType.Integer)
    private Integer salesCount;

    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second)
    private LocalDateTime createTime;
}
```

**搜索服务：**

```java
@Service
public class ProductSearchService {

    @Autowired
    private ElasticsearchRestTemplate esTemplate;

    public PageResult<ProductDoc> search(ProductSearchDTO dto) {
        NativeSearchQueryBuilder builder = new NativeSearchQueryBuilder();

        // 构建布尔查询
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();

        // 关键词搜索（多字段匹配）
        if (StringUtils.isNotBlank(dto.getKeyword())) {
            boolQuery.must(QueryBuilders.multiMatchQuery(dto.getKeyword(), "name", "description")
                    .type(MultiMatchQueryBuilder.Type.BEST_FIELDS)
                    .minimumShouldMatch("75%"));
        }

        // 分类筛选
        if (StringUtils.isNotBlank(dto.getCategoryCode())) {
            boolQuery.filter(QueryBuilders.termQuery("categoryCode", dto.getCategoryCode()));
        }

        // 价格范围
        if (dto.getMinPrice() != null || dto.getMaxPrice() != null) {
            RangeQueryBuilder rangeQuery = QueryBuilders.rangeQuery("price");
            if (dto.getMinPrice() != null) rangeQuery.gte(dto.getMinPrice());
            if (dto.getMaxPrice() != null) rangeQuery.lte(dto.getMaxPrice());
            boolQuery.filter(rangeQuery);
        }

        builder.withQuery(boolQuery);

        // 排序
        if ("price_asc".equals(dto.getSortBy())) {
            builder.withSorts(SortBuilders.fieldSort("price").order(SortOrder.ASC));
        } else if ("sales".equals(dto.getSortBy())) {
            builder.withSorts(SortBuilders.fieldSort("salesCount").order(SortOrder.DESC));
        } else {
            // 默认按相关度排序
            builder.withSorts(SortBuilders.scoreSort().order(SortOrder.DESC));
        }

        // 分页
        builder.withPageable(PageRequest.of(dto.getPageNum() - 1, dto.getPageSize()));

        // 高亮
        builder.withHighlightBuilder(new HighlightBuilder()
                .field("name").preTags("<em>").postTags("</em>"));

        SearchHits<ProductDoc> hits = esTemplate.search(builder.build(), ProductDoc.class);

        // 封装结果
        List<ProductDoc> docs = hits.getSearchHits().stream()
                .map(hit -> {
                    ProductDoc doc = hit.getContent();
                    // 替换高亮字段
                    if (hit.getHighlightFields().containsKey("name")) {
                        doc.setName(hit.getHighlightFields().get("name").get(0));
                    }
                    return doc;
                })
                .toList();

        return new PageResult<>(hits.getTotalHits(), docs);
    }
}
```

**MySQL 与 ES 的分工：**

| 维度 | MySQL | Elasticsearch |
|------|-------|---------------|
| 数据角色 | 主数据源（权威数据） | 搜索副本（可重建） |
| 写入 | 所有写操作 | 通过 Canal/MQ 同步 |
| 简单查询 | 主键查询、关联查询 | 不使用 |
| 搜索查询 | 不使用（LIKE太慢） | 全文搜索、聚合分析 |
| 一致性 | 强一致 | 准实时（秒级延迟） |
| 故障影响 | 数据不可写 | 搜索不可用，降级为MySQL模糊查询 |

> ⚠️ ES 数据可以从 MySQL 完整重建，所以 ES 索引损坏不会丢失数据。但要提前准备好全量同步脚本。

---

## 附录：面试高频速查

### 索引相关

| 问题 | 要点 |
|------|------|
| B+树为什么适合做索引 | 矮胖树，3层可存千万级数据；叶子节点链表支持范围查询；非叶子节点只存key，一个页能放更多key |
| 聚簇索引 vs 非聚簇索引 | 聚簇索引叶子节点存完整行数据（InnoDB主键）；非聚簇索引叶子节点存主键值，需要回表 |
| 覆盖索引 | 查询的字段全部在索引中，无需回表。EXPLAIN Extra 显示 Using index |
| 索引下推(ICP) | MySQL 5.6+，在存储引擎层利用索引过滤，减少回表次数。Extra 显示 Using index condition |
| 最左前缀原则 | 联合索引按最左列开始匹配，跳过中间列则后续列索引失效 |

### 事务相关

| 问题 | 要点 |
|------|------|
| ACID | 原子性(undo log)、一致性(目标)、隔离性(锁+MVCC)、持久性(redo log) |
| 隔离级别 | 读未提交 → 读已提交(Oracle默认) → 可重复读(MySQL默认) → 串行化 |
| MVCC | 多版本并发控制。每行有隐藏的 trx_id 和 roll_pointer，通过 ReadView 判断可见性 |
| 幻读解决 | InnoDB 在可重复读级别下通过 Next-Key Lock（记录锁+间隙锁）解决幻读 |

### 锁相关

| 问题 | 要点 |
|------|------|
| 行锁实现 | InnoDB 行锁基于索引实现。不走索引的更新会退化为表锁 |
| 死锁排查 | `SHOW ENGINE INNODB STATUS` 查看最近一次死锁信息 |
| 死锁预防 | 固定加锁顺序；缩小事务范围；避免大事务 |

### 日志相关

| 日志 | 作用 | 层级 |
|------|------|------|
| redo log | 保证持久性，崩溃恢复 | InnoDB 引擎层 |
| undo log | 保证原子性，回滚+MVCC | InnoDB 引擎层 |
| binlog | 主从复制，数据备份 | MySQL Server 层 |
| slow query log | 记录慢查询 | MySQL Server 层 |

---

> 本手册基于 MySQL 8.0、Spring Boot 3.x、MyBatis-Plus 3.5.x 编写。持续更新中。
