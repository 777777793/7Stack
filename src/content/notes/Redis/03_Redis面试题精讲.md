# Redis 面试题精讲

> 定位：面试实战手册，33 道题覆盖基础到高级，每题三层回答。
>
> 难度标注：⭐ 基础 / ⭐⭐ 中等 / ⭐⭐⭐ 高频难题 / ⭐⭐⭐⭐ 高级

---

## 一、基础认知类

### 1. Redis 是什么？为什么要用 Redis？

**🎯 面试直答版：**

Redis 是一个**基于内存的高性能键值数据库**，核心定位是做**缓存层**，同时也常被用来做分布式锁、消息队列、计数器这些。

我们项目中用它，根本原因就一个字：**快**。它是纯内存操作，加上单线程模型和 IO 多路复用，单机轻松抗住几万甚至十万 QPS。相比直接查 MySQL，延迟从毫秒级降到微秒级，高并发场景下能直接把数据库的压力扛下来。

**📖 深度解析版：**

用 Redis 解决的核心问题是 **MySQL 等关系型数据库在高并发读场景下的性能瓶颈**。

典型路径：业务初期直接查 MySQL → 用户量增长后 QPS 上万 → MySQL 连接数打满、响应变慢 → 在 MySQL 前面加一层 Redis 缓存 → 热点数据从 Redis 读取，MySQL 压力骤降。

除了缓存，Redis 还能做：
- 分布式锁（利用单线程的原子性）
- 排行榜（ZSet 天然排序）
- 计数器/限流（INCR 原子递增）
- 分布式 Session
- 消息队列（Stream / List）

**💡 加分项：** 在实际项目中，我们通常采用多级缓存架构：Caffeine（本地 L1）→ Redis（分布式 L2）→ MySQL。本地缓存处理超高频热点，Redis 处理一般热点，MySQL 兜底。这样即使 Redis 故障，本地缓存也能扛一部分流量。

---

### 2. Redis 为什么这么快？

> ⚠️ 这是最高频的 Redis 面试题之一，几乎必问。

**🎯 面试直答版：**

三个核心原因：①纯内存操作，内存访问比磁盘快 10 万倍；②单线程执行命令，避免了锁竞争和上下文切换；③IO 多路复用（epoll），一个线程高效处理数千连接。

**📖 深度解析版：**

```
第一层：存储介质 → 内存
  内存随机读：~100ns
  磁盘随机读：~10ms（SSD）/ ~10ms（HDD 寻道）
  差距 10 万倍，这是快的根本原因

第二层：线程模型 → 单线程执行命令
  为什么单线程反而快？
  ① Redis 的瓶颈不在 CPU，而在内存和网络
  ② 单线程没有锁竞争、没有上下文切换（上下文切换一次约 1~2μs）
  ③ 单线程代码更简单，数据结构不需要加锁

第三层：IO 模型 → epoll 多路复用
  一个线程同时监听数千个 Socket
  非阻塞 IO，哪个连接有数据就处理哪个
  避免了"一连接一线程"的资源浪费

第四层：数据结构精心设计
  SDS、跳表、压缩列表等针对不同场景优化的数据结构
  小数据用紧凑结构（省内存），大数据用高效结构（保性能）
```

**💡 加分项：** Redis 6.0 引入了多线程，但只用于网络 IO 的读写，命令执行仍然是单线程。因为在高带宽场景下，网络 IO 成了新的瓶颈，用多线程做 IO 可以显著提升吞吐量。可以通过 `io-threads 4` 开启。

---

### 3. Redis 有哪些数据类型？分别适合什么场景？

**🎯 面试直答版：**

五种基础类型：String（缓存/计数器）、Hash（对象属性存储）、List（消息队列/时间线）、Set（去重/社交关系）、ZSet（排行榜/延迟队列）。四种特殊类型：Bitmap（签到/状态标记）、HyperLogLog（UV 统计）、GEO（附近的人）、Stream（消息队列）。

**📖 深度解析版：**

| 类型 | 底层实现 | 典型场景 | 复杂度 |
|---|---|---|---|
| String | SDS / int / embstr | 缓存、计数器、分布式锁、Session | GET/SET: O(1) |
| Hash | listpack / hashtable | 用户信息、商品属性（需要部分更新字段） | HGET/HSET: O(1) |
| List | quicklist(listpack+链表) | 消息队列、最新动态、分页查询 | LPUSH/RPOP: O(1) |
| Set | intset / hashtable | 标签、共同好友、抽奖去重 | SADD/SISMEMBER: O(1) |
| ZSet | listpack / skiplist+ht | 排行榜、延迟队列、带权重的优先级 | ZADD: O(logN) |
| Bitmap | String（按位操作） | 签到、在线状态、布隆过滤器 | SETBIT: O(1) |
| HyperLogLog | 稀疏/稠密编码 | UV 统计（允许 0.81% 误差，仅 12KB） | PFADD: O(1) |
| GEO | ZSet（GeoHash 编码） | 附近的人/店、距离计算 | GEOADD: O(logN) |
| Stream | Radix Tree + listpack | 消息队列（支持消费者组、ACK、回溯） | XADD: O(1) |

**💡 加分项：** 选型时的关键判断——如果你在犹豫用 String 存 JSON 还是用 Hash：总是整体读写用 String 更简单，需要频繁更新部分字段用 Hash。但 Hash 在字段特别多（上百个）时内存反而更高。

---

### 4. Redis 是单线程还是多线程？

**🎯 面试直答版：**

Redis 的**命令执行**始终是单线程的。Redis 6.0 引入了多线程，但只用于网络 IO 的读写解析，不涉及命令执行逻辑，因此不需要加锁。

**📖 深度解析版：**

```
Redis 不同版本的线程模型：

Redis 4.x：
  - 命令执行：单线程
  - 网络 IO：单线程
  - 后台任务（持久化、lazy-free 删除等）：额外线程

Redis 6.0+：
  - 命令执行：单线程（不变！）
  - 网络 IO：多线程（新增，默认关闭）
  - 后台任务：额外线程

为什么命令执行不用多线程？
  ① 多线程引入锁，Redis 的核心数据结构需要全部加锁，开销可能抵消收益
  ② Redis 的性能瓶颈不在 CPU，单线程执行命令绑定一个 CPU 核心足够
  ③ 代码复杂度指数级上升，维护和调试难度大增
```

**💡 加分项：** 严格来说 Redis 一直不是"纯单线程"。4.0 就有了 `lazy-free` 后台线程（UNLINK 命令用它异步删除大 Key），BGSAVE/BGREWRITEAOF 会 fork 子进程。6.0 的多线程 IO 只是让网络层面也并行了。

---

### 5. Redis 和 Memcached 有什么区别？

**🎯 面试直答版：**

核心区别：Redis 支持丰富的数据结构（不只是 String），支持持久化，支持集群和主从复制。Memcached 只支持简单 KV，不支持持久化，但在纯字符串缓存场景下多线程性能可能更高。**现在企业基本都选 Redis**。

**📖 深度解析版：**

| 对比维度 | Redis | Memcached |
|---|---|---|
| 数据结构 | String/Hash/List/Set/ZSet/Stream等 | 只有 String |
| 持久化 | RDB + AOF | 不支持 |
| 集群 | 原生 Cluster + Sentinel | 客户端分片 |
| 线程模型 | 单线程命令执行（6.0 多线程 IO） | 多线程 |
| 内存管理 | 自带淘汰策略（8种） | LRU |
| 发布订阅 | 支持 | 不支持 |
| Lua 脚本 | 支持 | 不支持 |
| 单个 Value 大小 | 512MB | 1MB |

**💡 加分项：** Memcached 在高并发纯 KV 读取场景下可能略快（多线程），但 Redis 的功能丰富性让它在实际项目中适用面更广。除非有特殊性能要求，否则统一用 Redis 可以降低运维复杂度。

---

## 二、持久化类

### 6. RDB 和 AOF 的区别？

**🎯 面试直答版：**

RDB 是某个时间点的内存快照，文件小、恢复快，但两次快照之间数据可能丢失。AOF 记录每条写命令，数据更安全（最多丢 1 秒），但文件大、恢复慢。生产环境推荐混合持久化（4.0+），结合两者优点。

**📖 深度解析版：**

```
                RDB vs AOF 完整对比

  ┌────────────┬─────────────────────┬─────────────────────┐
  │            │       RDB            │       AOF            │
  ├────────────┼─────────────────────┼─────────────────────┤
  │ 原理       │ 定时生成内存快照     │ 追加记录每条写命令   │
  │ 文件大小   │ 小（二进制压缩）     │ 大（文本命令格式）   │
  │ 恢复速度   │ 快（直接加载到内存）  │ 慢（重放所有命令）   │
  │ 数据安全   │ 可能丢几分钟数据     │ 最多丢 1 秒数据      │
  │ 对性能影响 │ fork 时短暂阻塞      │ everysec 几乎无影响  │
  │ 文件可读性 │ 二进制，不可读       │ 文本，可读可编辑     │
  │ 适用场景   │ 备份、灾难恢复       │ 数据安全要求高       │
  └────────────┴─────────────────────┴─────────────────────┘

混合持久化（Redis 4.0+，推荐）：
  AOF 重写时，前半部分写 RDB 格式，后半部分写 AOF 增量命令
  恢复时先快速加载 RDB 部分，再重放少量 AOF 命令
  → 兼顾恢复速度和数据安全
```

**💡 加分项：** RDB 的 BGSAVE 使用 fork + COW（写时复制），fork 本身很快（复制页表），但如果在 BGSAVE 期间有大量写入，COW 会复制大量内存页，最坏情况下内存翻倍。所以要为 Redis 预留足够的内存余量（建议 `maxmemory` 不超过物理内存的 50%）。

---

### 7. Redis RDB 为什么用子进程，而不是用线程？

**🎯 面试直答版：**

核心原因是：**子进程可以通过 fork + COW（写时复制）拿到一份“逻辑上静止”的内存快照，而主进程几乎不用停下来加锁**。如果改成线程，线程共享同一块内存，主线程一边处理写请求、后台线程一边遍历内存生成 RDB，就必须大量加锁，性能会明显下降，还容易影响 Redis 的单线程模型。

**📖 深度解析版：**

```
为什么子进程更合适？

① 数据一致性更容易保证
  fork 之后，子进程看到的是 fork 那一刻的内存视图
  主进程后续继续处理写命令
  如果某个内存页被修改，操作系统才通过 COW 复制该页
  → 子进程始终基于"快照时刻"的数据生成 RDB

② 不需要给核心数据结构加大量锁
  Redis 主线程还要继续处理客户端请求
  如果后台线程和主线程共享内存：
    - 后台线程遍历 dict、跳表、压缩结构时
    - 主线程可能同时增删改
  为了防止并发问题，就得加锁
  → 锁竞争 + 上下文切换 + 代码复杂度都会上来

③ 比"手动拷贝一份内存再落盘"更省
  如果不用 fork，就只能自己复制一份全量数据给线程
  这本身就是重操作，耗时和内存开销都很大
  fork 只复制页表，真正的数据页按需复制
  → 大多数场景下比全量 memcpy 更划算

④ 隔离性更好
  子进程即使在生成 RDB 时崩了，通常也不会把主进程一起带崩
  如果是线程，崩溃风险会直接影响整个 Redis 进程
```

**💡 加分项：** 这不是说“线程绝对不能做”，而是 **在 Unix 下，fork + COW 是生成内存快照的天然方案**。Redis 选子进程，本质上是在“一致性、性能、实现复杂度”之间做了最优工程权衡。代价就是 fork 瞬间会有短暂阻塞，而且快照期间写入多的话，COW 会带来额外内存开销。

---

### 8. AOF 重写是怎么实现的？

**🎯 面试直答版：**

AOF 重写是 fork 子进程根据当前内存数据生成最精简的命令集（比如 100 次 INCR 变成 1 条 SET），期间主进程新产生的命令写入重写缓冲区，子进程完成后追加缓冲区内容，最后原子替换旧文件。

**📖 深度解析版：**

```
AOF 重写完整流程：

  主进程                           子进程
    │
    │ ① 触发重写（自动或手动 BGREWRITEAOF）
    │
    │ ② fork 子进程
    │──────────────────────→ 子进程启动
    │                              │
    │ 继续处理客户端请求            │ ③ 遍历内存中的数据
    │                              │    生成等效命令写入新 AOF 文件
    │ ④ 新产生的写命令             │    （100 次 INCR key → SET key 100）
    │    同时写入：                 │
    │    a. 旧 AOF 文件（保证安全） │
    │    b. AOF 重写缓冲区         │
    │                              │
    │                              │ ⑤ 写完，通知主进程
    │ ⑥ 把重写缓冲区的内容         │
    │    追加到新 AOF 文件          │
    │                              │
    │ ⑦ 原子替换旧 AOF 文件        │
    ▼                              ▼
```

为什么要有**重写缓冲区**？
- 子进程遍历内存的过程中，主进程还在接受写命令
- 这些新命令必须记录下来，否则新 AOF 文件会丢失这部分数据
- 双写（旧 AOF + 缓冲区）保证了即使重写失败，旧 AOF 仍然完整

**💡 加分项：** AOF 重写期间步骤 ⑥（追加缓冲区到新文件）会造成主线程短暂阻塞。如果缓冲区积累了很多数据（比如重写期间写入特别频繁），这个阻塞时间可能比较长。监控 `aof_rewrite_buffer_length` 可以提前发现这个问题。

---

### 9. Redis 数据恢复的流程是怎样的？

**🎯 面试直答版：**

Redis 启动时，如果开启了 AOF 则优先加载 AOF 文件（数据更完整），否则加载 RDB 文件。混合持久化下，AOF 文件前半部分是 RDB 格式（快速加载），后半部分是 AOF 命令（补齐增量）。

**📖 深度解析版：**

```
Redis 启动 → 数据恢复决策树：

  开启了 AOF？
    ├── 是 → 加载 AOF 文件
    │         ├── 混合持久化？
    │         │    ├── 是 → 先加载 RDB 部分（快），再重放 AOF 增量部分
    │         │    └── 否 → 重放整个 AOF 文件（慢）
    │         │
    │         └── AOF 文件损坏？
    │              → 用 redis-check-aof --fix 修复（截断损坏部分）
    │
    └── 否 → 加载 RDB 文件
              └── RDB 文件不存在或损坏？
                   → 空数据库启动
```

**💡 加分项：** AOF 优先级高于 RDB 是因为 AOF 数据更新（最多丢 1 秒 vs 可能丢几分钟）。但在某些灾难恢复场景下，如果 AOF 文件损坏严重无法修复，可以手动删除 AOF 文件让 Redis 从 RDB 恢复（虽然会丢一些数据，但总比启动不了好）。

---

### 10. 混合持久化是什么？为什么推荐？

**🎯 面试直答版：**

混合持久化是 Redis 4.0 引入的，在 AOF 重写时，文件前半部分用 RDB 格式存全量数据（加载快），后半部分用 AOF 格式存增量命令（数据全）。既有 RDB 的恢复速度，又有 AOF 的数据安全性。

**📖 深度解析版：**

```
传统 AOF 的问题：
  数据量 10GB → AOF 重放可能需要几分钟甚至十几分钟才能恢复
  这段时间 Redis 不可用，对业务影响很大

混合持久化的 AOF 文件结构：
  ┌────────────────────────────┬─────────────────────┐
  │    RDB 二进制格式            │   AOF 文本格式        │
  │    （AOF 重写时刻的全量数据）│  （重写后的增量命令）  │
  │    加载时间：秒级            │   加载时间：很短       │
  └────────────────────────────┴─────────────────────┘

恢复过程：
  ① 识别文件头为 RDB 格式 → 快速加载全量数据（秒级）
  ② 读到 RDB 结束标志后 → 切换为 AOF 模式，重放少量增量命令
  ③ 恢复完成（总时间接近纯 RDB 的速度）

开启方式：
  aof-use-rdb-preamble yes    # Redis 4.0+ 可用，5.0+ 默认开启
```

**💡 加分项：** 混合持久化在 Redis 5.0 之后默认开启。如果你的项目还在用纯 AOF，建议升级到混合模式。实测 10GB 数据恢复时间从 3-5 分钟缩短到 10 秒以内。

---

## 三、缓存设计类

### 11. 什么是缓存穿透？怎么解决？

> ⚠️ 缓存三大问题（穿透/雪崩/击穿）是面试必考题，务必区分清楚。

**🎯 面试直答版：**

缓存穿透是查询一个**根本不存在**的数据，缓存永远不命中，请求全部打到数据库。解决方案：①缓存空值（简单）；②布隆过滤器（适合数据量大的场景）。

**📖 深度解析版：**

```
穿透的本质：缓存和数据库里都没有的数据被反复查询

触发场景：
  ① 恶意攻击：用随机不存在的 ID 大量请求（如 id=-1, id=99999999）
  ② 业务 Bug：前端传了错误参数

方案一：缓存空值
  查 DB 没查到 → 在 Redis 中缓存 key → null，设置短 TTL（如 2 分钟）
  优点：简单直接
  缺点：如果攻击用大量不同的 Key，Redis 会缓存大量无用空值

方案二：布隆过滤器
  在 Redis 前面加一层布隆过滤器，所有存在的 Key 都提前加入
  请求先过布隆过滤器：
    不存在 → 一定不存在，直接返回（100% 准确）
    存在   → 可能存在，继续查 Redis 和 DB（有小概率误判）
  优点：内存占用极小（1 亿数据约 100MB），几乎不影响性能
  缺点：有误判率（可控，通常 < 1%），不支持删除（可用布谷鸟过滤器替代）

方案三：参数校验（治本）
  在接口层做参数校验，拦截明显非法请求（如 id <= 0）
```

**💡 加分项：** 生产环境通常是多种方案组合：接口层参数校验 + 布隆过滤器 + 缓存空值。Redisson 提供了开箱即用的布隆过滤器实现 `RBloomFilter`。

---

### 12. 什么是缓存雪崩？怎么解决？

**🎯 面试直答版：**

缓存雪崩是**大量 Key 同时过期**（或 Redis 宕机），请求瞬间全部涌入数据库。解决方案：①过期时间加随机偏移量；②多级缓存；③热点数据永不过期 + 后台异步更新。

**📖 深度解析版：**

```
雪崩的两种触发方式：

方式一：大量 Key 同时过期
  常见原因：系统启动时批量预热缓存，所有 Key 用了相同的 TTL
  解决：
    ① 过期时间 = 基础 TTL + 随机偏移量
       Duration ttl = baseTTL.plusSeconds(random.nextLong(0, 300));
    ② 热点数据永不过期，后台定时刷新
    ③ 多级缓存（Caffeine L1 + Redis L2），Redis 失效时 L1 还能顶一会

方式二：Redis 整体宕机
  解决：
    ① 高可用架构（Sentinel / Cluster），避免单点故障
    ② 本地缓存兜底（Redis 不可用时降级到 Caffeine）
    ③ 限流降级：对数据库的请求做限流，宁可部分用户返回降级结果
    ④ 提前预案：Redis 持久化 + 快速恢复
```

**💡 加分项：** Netflix 的 Hystrix（现在是 Resilience4j）就是处理这类问题的框架，可以在缓存层熔断后自动降级到预设的兜底逻辑，而不是让所有请求打到数据库。

---

### 13. 什么是缓存击穿？怎么解决？

**🎯 面试直答版：**

缓存击穿是**某个热点 Key 过期的瞬间**，大量并发请求同时查数据库。和雪崩的区别是：击穿是单个热点 Key，雪崩是大批量 Key。解决方案：①互斥锁（只让一个线程查 DB）；②逻辑过期（不设真 TTL，在 Value 里维护过期时间）。

**📖 深度解析版：**

```
方案一：互斥锁（Mutex Lock）
  ┌────────────────────────────────────────────────┐
  │  请求到达 → 缓存未命中                          │
  │    → 尝试获取分布式锁（SETNX）                  │
  │      → 成功：查 DB → 写缓存 → 释放锁            │
  │      → 失败：等待（sleep 50ms）→ 重试查缓存      │
  └────────────────────────────────────────────────┘
  优点：保证缓存和 DB 数据一致
  缺点：等锁期间其他线程阻塞，影响吞吐

方案二：逻辑过期
  ┌────────────────────────────────────────────────┐
  │  不设 Redis TTL（Key 永不过期）                  │
  │  Value 中存：{ data: {...}, expireTime: xxx }   │
  │                                                │
  │  读取时检查 expireTime：                         │
  │    → 未过期：直接返回                            │
  │    → 已过期：                                   │
  │        获取锁 → 开新线程异步更新缓存             │
  │        当前请求先返回旧数据                       │
  └────────────────────────────────────────────────┘
  优点：不阻塞，高可用
  缺点：短暂的数据不一致（返回旧数据）
```

**💡 加分项：** 互斥锁方案要注意"双重检查"——获取锁之后，先再查一次缓存（可能其他线程已经写入了），避免重复查 DB。另外，锁一定要设过期时间（防止持锁线程宕机导致死锁）。

---

### 14. 如何保证缓存和数据库的一致性？

> ⚠️ 这是面试中最容易被追问到底的题目。

**🎯 面试直答版：**

主流方案是 **Cache Aside Pattern**：读时先查缓存、未命中查 DB 后写缓存；写时先更新 DB，再删除缓存。要做到强一致性很难，通常追求最终一致性。

**📖 深度解析版：**

```
为什么是「删除缓存」而不是「更新缓存」？

  并发场景下更新缓存的问题：
    线程 A 更新 DB（price=100）→ 线程 B 更新 DB（price=200）
    → 线程 B 更新缓存（200）→ 线程 A 更新缓存（100）  ← 覆盖了！
    结果：DB 是 200，缓存是 100 → 不一致

  删除缓存就没这个问题：
    不管谁先谁后，缓存都被删了
    下次读的时候自然从 DB 加载最新值

为什么是「先更新 DB 再删缓存」而不是反过来？

  先删缓存再更新 DB 的问题：
    线程 A 删缓存 → 线程 B 读缓存（未命中）→ 线程 B 读 DB（旧值）
    → 线程 B 写缓存（旧值）→ 线程 A 更新 DB（新值）
    结果：DB 是新值，缓存是旧值 → 不一致，且长时间不一致（直到缓存过期）

  先更新 DB 再删缓存也有小概率不一致，但条件极苛刻：
    需要读 DB 比写 DB 还慢（写 DB 在读 DB 完成之前就完成了）
    这在实际中几乎不会发生（写操作通常比读操作慢）
```

**进阶方案（追求更高一致性）：**

```
方案一：延迟双删
  ① 删除缓存 → ② 更新 DB → ③ 延迟 500ms → ④ 再删一次缓存
  第二次删除兜底处理并发读写导致的脏缓存

方案二：基于 binlog 的异步删除（最可靠）
  ① 应用只负责更新 DB
  ② Canal 监听 MySQL binlog → 解析出变更的数据
  ③ 发送消息到 MQ → 消费者删除对应的缓存
  好处：应用代码无侵入，保证最终一致性
  坏处：引入了更多组件，架构更复杂
```

**💡 加分项：** 在实际项目中，"先更新 DB 再删缓存"配合"TTL 兜底"已经能满足 99% 的场景。对一致性要求极高的场景（如库存），可以用分布式锁串行化读写操作，但会牺牲并发性能。

---

### 15. 如何设计一个缓存预热方案？

**🎯 面试直答版：**

缓存预热是在系统启动时提前把热点数据加载到 Redis，避免启动后大量请求直接打到数据库。方案包括：①启动脚本批量加载；②定时任务定期刷新；③基于日志分析的智能预热。

**📖 深度解析版：**

```java
// 方案一：Spring Boot 启动后自动预热
@Component
public class CacheWarmer implements CommandLineRunner {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    @Autowired
    private ProductMapper productMapper;

    @Override
    public void run(String... args) {
        // 加载 Top 1000 热门商品（根据历史访问量排序）
        List<Product> hotProducts = productMapper.selectTopHot(1000);

        // 用 Pipeline 批量写入（比逐个写快 100 倍）
        redisTemplate.executePipelined((RedisCallback<Object>) connection -> {
            for (Product p : hotProducts) {
                String key = "product:detail:" + p.getId();
                byte[] value = serialize(p);
                // 过期时间加随机偏移，防止同时过期
                long ttl = 1800 + ThreadLocalRandom.current().nextLong(300);
                connection.stringCommands().setEx(key.getBytes(), ttl, value);
            }
            return null;
        });
    }
}
```

**💡 加分项：** 大规模预热（百万级 Key）不要在启动时同步做，会拖慢启动时间。用异步线程池或定时任务分批加载，每批之间 sleep 一下，避免瞬间打满 Redis 连接。

---

### 16. 热 Key 问题怎么解决？

**🎯 面试直答版：**

热 Key 是指某个 Key 被极高频率访问，超出了单个 Redis 节点的承受能力。解决方案：①本地缓存（Caffeine）分摊热点压力；②Key 分散（同一数据复制到多个 Key，随机读取）；③读写分离。

**📖 深度解析版：**

```
如何发现热 Key？
  ① redis-cli --hotkeys（Redis 4.0+，需开启 LFU 策略）
  ② 在客户端做统计（请求计数器，超过阈值告警）
  ③ 用 MONITOR 命令（生产慎用，会影响性能）
  ④ 通过代理层（如 Codis）收集统计

解决方案：

方案一：本地缓存（最常用）
  在应用层加一层 Caffeine 缓存
  热 Key → 先查本地缓存（纳秒级）→ 未命中再查 Redis
  配合较短的本地 TTL（5-10 秒），在一致性和性能之间平衡

方案二：Key 分散
  把 product:detail:1 复制为 product:detail:1:v1 ~ product:detail:1:v8
  读取时随机选一个 Key → 请求分散到不同的 Cluster 节点
  缺点：更新时需要更新所有副本

方案三：读写分离
  给 Master 配置多个 Slave
  读请求分散到多个 Slave 上
  适合读多写少的场景
```

**💡 加分项：** 字节跳动等大厂内部有热 Key 自动发现和迁移的中间件。开源方案中 JD 的 `hotkey` 可以实时探测热 Key 并自动推送到本地缓存。

---

## 四、分布式类

### 17. Redis 分布式锁怎么实现？

> ⚠️ 分布式锁是 Redis 面试的重中之重。

**🎯 面试直答版：**

基本原理是 `SET key value NX EX`（不存在才设置 + 设过期时间），保证原子性。但自己实现有很多坑（锁续期、可重入、主从切换锁丢失），**生产环境直接用 Redisson**，它都帮你处理好了。

**📖 深度解析版：**

```
手动实现分布式锁的演进过程：

V1：SETNX + EXPIRE（有问题！）
  SETNX lock_key unique_value    // 加锁
  EXPIRE lock_key 10             // 设过期时间
  问题：两条命令不是原子的，如果 SETNX 后宕机，锁永远不会过期（死锁）

V2：SET NX EX（原子操作）
  SET lock_key unique_value NX EX 10
  问题：业务执行时间超过锁的过期时间 → 锁自动释放 → 其他线程获取锁
        → 两个线程同时持有"锁"

V3：SET NX EX + 续期（看门狗）
  加锁后启动后台线程，每隔 TTL/3 时间检查锁是否还持有
  如果还持有 → 续期
  问题：实现复杂，还要考虑可重入

V4：Redisson（生产方案）
  内置看门狗（默认 30 秒，每 10 秒续期一次）
  支持可重入（同一线程多次加锁，维护计数器）
  支持公平锁、联锁、读写锁等高级特性
  底层用 Lua 脚本保证原子性
```

```
为什么释放锁要用 Lua 脚本？

  错误的释放方式：
    if (redis.get(key) == myValue) {   // ① 判断是自己的锁
        redis.del(key);                 // ② 删除
    }
    在 ① 和 ② 之间，锁可能已经过期，被别人获取了
    此时 ② 删除的是别人的锁！

  正确方式（Lua 脚本，原子执行）：
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    else
        return 0
    end
```

**💡 加分项：** 在 Redis 主从架构下，锁可能丢失：客户端在 Master 上加锁成功，但锁还没同步到 Slave 时 Master 宕机了，Slave 升级为新 Master 后没有这把锁。Redis 作者提出了 **RedLock 算法**（在 N 个独立 Redis 实例上加锁，超过半数成功才算加锁成功），但这个方案有争议（Martin Kleppmann 的批评文章），实际项目中用 Redisson 的普通锁 + 合理的超时时间已经够用了。

---

### 18. Redisson 看门狗机制是什么？

**🎯 面试直答版：**

看门狗（Watchdog）是 Redisson 的自动续期机制。加锁时如果没有指定过期时间，Redisson 会启动一个后台线程，每隔 10 秒检查锁是否还被持有，如果是就续期到 30 秒。业务执行完释放锁后，看门狗停止。

**📖 深度解析版：**

```
看门狗的工作流程：

  ① lock.lock()（不指定 leaseTime）
  ② Redisson 用 Lua 脚本加锁，默认 TTL = 30 秒
  ③ 加锁成功 → 启动 Watchdog 定时任务
  ④ 每 10 秒（= lockWatchdogTimeout / 3）执行一次：
     - 检查当前线程是否还持有锁
     - 如果是 → 重新设置 TTL 为 30 秒（续期）
     - 如果否 → 停止定时任务
  ⑤ lock.unlock() → 释放锁 + 取消 Watchdog

  重要细节：
  - 如果手动指定了 leaseTime（如 tryLock(3, 10, SECONDS)），
    则 不会启动看门狗（你自己管过期时间）
  - 如果持锁线程宕机，Watchdog 也会停止，锁会在 30 秒后自动过期
  - Watchdog 存储在 Redisson 客户端的 ConcurrentHashMap 中，
    key 是锁的 entryName
```

**💡 加分项：** 看门狗的默认超时时间是 30 秒，可以通过 `Config.setLockWatchdogTimeout()` 调整。但不建议设得太短（频繁续期增加 Redis 压力）或太长（持锁线程宕机后要等很久锁才释放）。30 秒是个很好的平衡值。

---

### 19. Redis 主从同步时数据丢失怎么办？

**🎯 面试直答版：**

两种丢失场景：①异步复制丢失（Master 宕机时还没同步到 Slave 的数据）；②脑裂丢失（网络分区导致出现两个 Master）。通过配置 `min-replicas-to-write` 和 `min-replicas-max-lag` 可以减少丢失量。

**📖 深度解析版：**

```
场景一：异步复制丢失
  Master 收到写命令 → 返回客户端 OK → 异步复制给 Slave
  如果返回 OK 之后、复制之前 Master 宕机 → 这条数据丢失

场景二：脑裂（Split Brain）
  Master 与 Sentinel 网络断开，但 Master 仍在运行
  Sentinel 认为 Master 宕机 → 提升 Slave 为新 Master
  此时出现两个 Master，旧 Master 的写入在恢复后会被丢弃
  （旧 Master 变成新 Master 的 Slave，数据被新 Master 覆盖）

缓解方案：
  min-replicas-to-write 1       # 至少有 1 个 Slave 在线才允许写入
  min-replicas-max-lag 10       # Slave 复制延迟不超过 10 秒

  这两个配置的效果：
  - 如果 Master 发现没有任何 Slave 在正常同步 → 拒绝写入
  - 脑裂时，旧 Master 无法联系 Slave → 停止接受写入 → 最多丢 10 秒数据
```

**💡 加分项：** Redis 的复制是**异步**的（WAIT 命令可以做同步等待，但会阻塞客户端），所以无法做到零数据丢失。对数据一致性要求极高的场景（如金融交易），Redis 不适合做唯一数据源，应该以 MySQL 为准，Redis 只做缓存。

---

### 20. RedLock 算法是什么？有什么争议？

**🎯 面试直答版：**

RedLock 是 Redis 作者提出的分布式锁算法：在 N 个独立 Redis 实例上加锁，超过半数成功才算获取锁。解决了单实例主从切换时锁丢失的问题，但 Martin Kleppmann 认为它在 GC 停顿、时钟跳变等场景下不安全。

**📖 深度解析版：**

```
RedLock 算法流程（假设 5 个 Redis 实例）：

  ① 记录当前时间 T1
  ② 依次向 5 个 Redis 实例发送加锁请求（SET NX EX）
     每个请求设置较短的超时时间（如 50ms），防止某个实例不可用时阻塞太久
  ③ 记录当前时间 T2
  ④ 如果满足以下条件，认为加锁成功：
     a. 超过半数（≥3）实例加锁成功
     b. 加锁总耗时（T2-T1）< 锁的过期时间
  ⑤ 锁的有效时间 = 锁过期时间 - 加锁耗时
  ⑥ 如果加锁失败 → 向所有实例发送释放锁请求

争议（Martin Kleppmann 的批评）：
  ① GC 停顿问题：
     线程获取锁后发生长时间 GC → 锁过期 → 其他线程获取锁
     → 两个线程同时认为自己持有锁
  ② 时钟跳变问题：
     如果某个 Redis 实例的系统时钟突然往前跳了几秒
     → 锁提前过期 → 安全性被破坏
  ③ 本质问题：RedLock 依赖时间假设（bounded delay），
     但在分布式系统中时间假设是不可靠的

Redis 作者（antirez）的回应：
  - GC 停顿是所有分布式锁都面临的问题，不是 RedLock 独有的
  - 实际环境中时钟跳变极少发生，可以通过 NTP 和监控避免
```

**💡 加分项：** 如果你的业务真的需要强一致性的分布式锁，应该用基于共识算法的方案，如 etcd（Raft）或 ZooKeeper（ZAB）。Redis 分布式锁更适合对一致性要求不那么严格的场景（如防止重复处理、限流等）。在实际项目中，Redisson 的普通分布式锁配合合理的业务设计（如幂等性保证），已经能覆盖绝大多数需求。

---

### 21. Redis 如何实现延迟队列？

**🎯 面试直答版：**

用 ZSet 实现：score 存任务的执行时间戳，消费者定时用 `ZRANGEBYSCORE` 查询到期的任务。比如订单 30 分钟未支付自动取消。

**📖 深度解析版：**

```java
@Service
public class DelayQueueService {

    @Autowired
    private StringRedisTemplate redisTemplate;

    private static final String DELAY_QUEUE_KEY = "delay:queue:order_timeout";

    // 生产者：添加延迟任务
    public void addDelayTask(String orderId, long delaySeconds) {
        double executeTime = System.currentTimeMillis() / 1000.0 + delaySeconds;
        redisTemplate.opsForZSet().add(DELAY_QUEUE_KEY, orderId, executeTime);
    }

    // 消费者：定时拉取到期任务（每秒执行一次）
    @Scheduled(fixedDelay = 1000)
    public void consumeDelayTask() {
        double now = System.currentTimeMillis() / 1000.0;

        // 查询所有到期的任务（score <= 当前时间）
        Set<String> tasks = redisTemplate.opsForZSet()
            .rangeByScore(DELAY_QUEUE_KEY, 0, now);

        if (tasks == null || tasks.isEmpty()) return;

        for (String orderId : tasks) {
            // 用 ZREM 原子性地移除，防止多个消费者重复处理
            Long removed = redisTemplate.opsForZSet().remove(DELAY_QUEUE_KEY, orderId);
            if (removed != null && removed > 0) {
                // 只有成功移除的消费者才执行业务逻辑
                handleOrderTimeout(orderId);
            }
        }
    }
}
```

**💡 加分项：** Redis 延迟队列适合轻量级场景。如果需要高可靠的延迟队列（消息不能丢），建议用 RocketMQ 的延迟消息或 RabbitMQ 的死信队列。Redisson 也提供了 `RDelayedQueue` 封装，使用更简便。

---

## 五、高可用与集群类

### 22. 哨兵模式的工作原理？

**🎯 面试直答版：**

Sentinel 是 Redis 的高可用方案：多个 Sentinel 节点监控 Master/Slave，当 Master 宕机时自动执行故障转移——选举一个 Slave 提升为新 Master，其他 Slave 指向新 Master，客户端自动切换。

**📖 深度解析版：**

```
故障转移完整流程：

① 主观下线（SDOWN）：
   单个 Sentinel 每秒 PING 一次 Master
   如果超过 down-after-milliseconds（默认 30 秒）没有有效回复
   → 该 Sentinel 认为 Master 主观下线

② 客观下线（ODOWN）：
   该 Sentinel 询问其他 Sentinel："你觉得 Master 挂了吗？"
   如果超过 quorum 个 Sentinel 都认为挂了
   → 客观下线确认

③ Sentinel Leader 选举：
   多个 Sentinel 用 Raft 协议选出一个 Leader
   由 Leader 执行后续的故障转移

④ 选择新 Master：
   优先级：
   a. replica-priority 最小的（手动设置的优先级）
   b. 复制偏移量最大的（数据最新）
   c. runid 最小的（兜底）

⑤ 故障转移：
   a. Leader 对选中的 Slave 执行 SLAVEOF NO ONE（提升为 Master）
   b. 通知其他 Slave 执行 SLAVEOF 新Master
   c. 如果旧 Master 恢复，也变成新 Master 的 Slave

⑥ 客户端感知：
   Sentinel 通过 Pub/Sub 发布切换消息
   Lettuce/Redisson 等客户端自动订阅并切换连接
```

**💡 加分项：** Sentinel 至少部署 3 个（奇数个），分散在不同的机器上。quorum 通常设为 Sentinel 数量的一半加一（如 3 个 Sentinel，quorum 设 2）。如果所有 Sentinel 都在同一台机器上，那机器一宕机，Sentinel 也全挂了，就失去意义了。

---

### 23. Redis Cluster 的数据分片原理？

**🎯 面试直答版：**

Redis Cluster 把所有 Key 分成 16384 个 Hash Slot，用 CRC16(key) % 16384 计算 Key 属于哪个 Slot，每个 Master 节点负责一部分 Slot。客户端根据 Slot 映射表直接把请求发到正确节点。

**📖 深度解析版：**

```
Key 路由过程：

  Client 发送 GET user:1001
    ↓
  计算 slot = CRC16("user:1001") % 16384 = 7352
    ↓
  查本地 slot 映射表：slot 7352 → Node B (192.168.1.2:6379)
    ↓
  直接发给 Node B
    ↓
  如果映射表过期，Node 返回 MOVED 7352 192.168.1.3:6379
    ↓
  Client 更新映射表，重定向到正确节点

Hash Tag：让相关的 Key 落在同一个 Slot
  user:{1001}:name  → CRC16("1001") % 16384
  user:{1001}:email → CRC16("1001") % 16384
  只对 {} 中的内容做 Hash，保证这些 Key 在同一个节点上
  → 才能对它们做 MGET、事务、Lua 等多 Key 操作

为什么是 16384 个 Slot？
  ① Gossip 消息中需要携带 Slot 的 bitmap
     16384 bits = 2KB，带宽开销可接受
     如果用 65536 个 Slot = 8KB，心跳包太大
  ② 集群推荐不超过 1000 个 Master
     16384 / 1000 ≈ 16 个 Slot/节点，粒度足够
```

**💡 加分项：** Cluster 模式下不支持跨 Slot 的多 Key 操作（如 MGET key1 key2，如果它们不在同一个 Slot）。解决方案是用 Hash Tag（`{user}.name` 和 `{user}.age`），但要注意 Hash Tag 可能导致数据倾斜——如果某个 Tag 下的 Key 特别多，全部集中在一个节点上。

---

### 24. Redis Cluster 的扩缩容怎么做？

**🎯 面试直答版：**

扩容就是添加新节点并从现有节点迁移一部分 Slot 过去；缩容就是把要下线节点的 Slot 迁移到其他节点后再移除。迁移过程中 Key 可以正常读写，通过 ASK 重定向保证迁移期间的可用性。

**📖 深度解析版：**

```
Slot 迁移过程（源节点 A → 目标节点 B）：

  ① 目标 B 执行：CLUSTER SETSLOT <slot> IMPORTING <A-node-id>
     "我准备接收这个 Slot"
  ② 源 A 执行：CLUSTER SETSLOT <slot> MIGRATING <B-node-id>
     "我准备迁出这个 Slot"
  ③ 逐个迁移 Key：
     CLUSTER GETKEYSINSLOT <slot> <count>  // 获取这个 Slot 的 Key
     MIGRATE <B-host> <B-port> <key> 0 5000  // 迁移单个 Key
  ④ 迁移完成后：
     CLUSTER SETSLOT <slot> NODE <B-node-id>  // 通知所有节点

迁移期间的请求处理：
  客户端请求到达源 A：
    - Key 还在 A → 正常处理
    - Key 已迁移到 B → 返回 ASK 重定向（一次性重定向，不更新映射表）
    - 等迁移完全完成后 → 返回 MOVED 重定向（永久更新映射表）
```

**💡 加分项：** 实际生产中用 `redis-cli --cluster reshard` 命令自动完成 Slot 迁移。Redis 7.0 引入了 Shard 通道（Shard Pub/Sub），让 Pub/Sub 也支持 Cluster 分片，消息只在持有对应 Slot 的节点间传播。

---

### 25. Redis 集群脑裂问题怎么解决？

**🎯 面试直答版：**

脑裂是网络分区导致出现两个 Master，各自接受写入。分区恢复后旧 Master 的数据会被丢弃。通过配置 `min-replicas-to-write 1` + `min-replicas-max-lag 10` 限制旧 Master 在无 Slave 同步时拒绝写入，减少数据丢失。

**📖 深度解析版：**

```
脑裂发生过程：

  正常状态：
  [区域A]                    [区域B]
  Master ←── 复制 ──── Slave
  Sentinel1                 Sentinel2
                            Sentinel3

  网络分区：
  [区域A]         ╳         [区域B]
  Master（孤立）             Slave
  Sentinel1                 Sentinel2 ← 检测到 Master 下线
                            Sentinel3 ← 提升 Slave 为新 Master

  此时：
  区域A 的客户端继续往旧 Master 写数据
  区域B 的客户端往新 Master 写数据

  分区恢复后：
  旧 Master 变成新 Master 的 Slave → 旧 Master 的数据被丢弃！

防护措施：
  min-replicas-to-write 1     # Master 至少有 1 个 Slave 在同步
  min-replicas-max-lag 10     # Slave 延迟不超过 10 秒

  效果：旧 Master 发现没有 Slave 在同步 → 拒绝写入
  最多丢失 min-replicas-max-lag 秒的数据
```

**💡 加分项：** 脑裂是分布式系统中 CAP 定理的体现——网络分区（P）发生时，Redis 选择了可用性（A），牺牲了一致性（C）。如果业务要求在脑裂时不丢数据，需要让 Master 在检测到 Slave 不可达时立即拒绝写入（牺牲可用性换一致性）。

---

## 六、底层原理类

### 26. Redis 的跳表是什么？为什么 ZSet 不用红黑树？

**🎯 面试直答版：**

跳表是多层链表结构，通过在链表上建立"快速通道"实现 O(logN) 查找。ZSet 不用红黑树的原因：①跳表范围查询更简单（找到起点直接遍历）；②实现简单，代码易维护；③性能相当，但常数因子跳表可能更小。

**📖 深度解析版：**

```
跳表的核心思想：空间换时间

普通链表查找 37：1→7→11→23→37  需要走 4 步

跳表查找 37：
  L4: HEAD ──────────────────────→ 72（太大，下降）
  L3: HEAD ───→ 23 ──────────────→ 72（太大，下降）
  L2: 23 ───→ 37（找到了！）
  只需要 3 步

层数决定方式：
  随机化！每个节点有 p=0.25 的概率升一层
  期望层数 = 1/(1-p) ≈ 1.33
  最高 32 层

Redis 选择跳表而不是红黑树的原因：
  ① 范围查询：ZRANGEBYSCORE 是 ZSet 的核心操作
     跳表：找到起始节点，沿底层链表顺序遍历即可
     红黑树：需要中序遍历，实现更复杂
  ② 实现复杂度：跳表的插入删除只需修改前后指针
     红黑树需要旋转和变色，代码量是跳表的好几倍
  ③ 内存局部性：跳表的底层链表在内存中更连续（相对于树的指针跳转）
  ④ Redis 作者 antirez 的原话：
     "跳表实现简单，且性能和平衡树差不多"
```

**💡 加分项：** ZSet 底层同时维护了一个 hashtable（用于 O(1) 的 ZSCORE 查询）和一个 skiplist（用于排序和范围查询）。两者共享数据指针，不会多占一倍内存。这也解释了为什么 ZSet 的 ZSCORE 是 O(1) 而 ZRANK 是 O(logN)。

---

### 27. 渐进式 rehash 是什么？怎么实现的？

**🎯 面试直答版：**

Redis 的 hashtable 在扩容或缩容时，不是一次性搬迁所有数据，而是每次处理请求时顺便搬迁一个桶（rehashidx 指向的桶），同时后台定时任务每次搬迁 100 个桶。这样把 O(N) 的大操作拆成了每次请求的 O(1) 小操作，用户完全无感知。

**📖 深度解析版：**

```
渐进式 rehash 的完整机制：

触发条件：
  扩容：负载因子 = 已用节点数 / 桶数
    - 没有执行 BGSAVE/BGREWRITEAOF → 负载因子 ≥ 1 时扩容
    - 正在执行 BGSAVE/BGREWRITEAOF → 负载因子 ≥ 5 时扩容
    （fork 子进程时尽量避免内存操作，所以提高阈值推迟扩容）
  缩容：负载因子 < 0.1

过程：
  ① 创建 ht[1]（大小为 ht[0] 的 2 倍或最小满足的 2^n）
  ② 设置 rehashidx = 0
  ③ 每次 CRUD 操作时：
     把 ht[0][rehashidx] 上的所有节点迁移到 ht[1]
     rehashidx++
  ④ 后台 serverCron（每 100ms）也会搬迁，每次 1ms 限时
  ⑤ 查找/删除/更新时两个表都要检查
  ⑥ 新增只写 ht[1]（保证 ht[0] 只减不增）
  ⑦ ht[0] 所有桶搬完 → 释放 ht[0] → ht[1] 变成新 ht[0]

核心思想：
  把一次 O(N) 的大 rehash 分摊到每次请求中
  每次请求多做 O(1) 的迁移工作
  用户完全感知不到 rehash 在进行
```

**💡 加分项：** rehash 期间内存占用会短暂翻倍（两个 hashtable 共存）。如果 Redis 内存接近上限时触发 rehash，可能导致 OOM。这也是为什么建议 `maxmemory` 不要设太满的原因之一。

---

### 28. Redis 的内存淘汰策略 LRU 和 LFU 有什么区别？

**🎯 面试直答版：**

LRU（Least Recently Used）淘汰最近最少访问的 Key，适合访问具有时间局部性的场景。LFU（Least Frequently Used）淘汰访问频率最低的 Key，适合有明显冷热差异的场景。LFU 比 LRU 更精确，但 LRU 实现更简单，大多数场景够用。

**📖 深度解析版：**

```
LRU 的问题：
  假设有 Key A（每天被访问 1000 次）和 Key B（偶尔访问 1 次）
  如果 B 刚刚被访问了一次，而 A 在 1 分钟前被访问
  LRU 会认为 A 比 B "更旧"，优先淘汰 A
  但实际上 A 比 B 重要得多

LFU 的解决方案：
  基于访问频率，而不是最后访问时间
  A 访问 1000 次 vs B 访问 1 次 → 淘汰 B

Redis 的 LRU 实现（近似 LRU）：
  - 每个 Key 记录最后一次访问时间（redisObject.lru，24 位）
  - 淘汰时：随机抽样 maxmemory-samples 个 Key（默认 5）
  - 淘汰其中 lru 时间最老的
  - 不是精确 LRU（没有全局链表），但效果接近

Redis 的 LFU 实现（Redis 4.0+）：
  复用 redisObject.lru 的 24 位：
  ┌─────────────────┬──────────┐
  │ 16 位：上次衰减时间 │ 8 位：计数器 │
  └─────────────────┴──────────┘

  计数器不是简单的访问次数，而是对数计数器：
  - 每次访问时，以概率 1/(old_count * lfu_log_factor + 1) 递增
  - 计数越高，递增越难（8 位最大 255，用对数压缩能表示百万级访问量）
  - 定期衰减：每隔一段时间计数器减小，防止老数据永远不被淘汰

  配置：
  lfu-log-factor 10      # 计数器增长的对数因子（越大增长越慢）
  lfu-decay-time 1       # 每分钟衰减一次
```

**💡 加分项：** Redis 4.0 新增了 `OBJECT FREQ <key>` 命令查看 Key 的 LFU 计数器，可以用来发现热点 Key。生产环境中如果缓存数据有明显的冷热差异（比如 20% 的商品贡献 80% 的流量），LFU 比 LRU 效果更好。

---

### 29. Redis 的 RESP 协议是什么？

**🎯 面试直答版：**

RESP（Redis Serialization Protocol）是 Redis 客户端和服务端之间的通信协议，基于文本，设计简单，支持 5 种数据类型（简单字符串、错误、整数、批量字符串、数组）。简单到可以用 telnet 直接和 Redis 通信。

**📖 深度解析版：**

```
RESP 的 5 种数据类型：

  前缀   类型            示例
  +     简单字符串      +OK\r\n
  -     错误            -ERR unknown command\r\n
  :     整数            :1000\r\n
  $     批量字符串      $5\r\nHello\r\n    （$后是字节长度）
  *     数组            *2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n

客户端发送 SET name Redis 的实际数据：
  *3\r\n          ← 数组，3 个元素
  $3\r\n          ← 第 1 个元素长度 3
  SET\r\n         ← 第 1 个元素
  $4\r\n          ← 第 2 个元素长度 4
  name\r\n        ← 第 2 个元素
  $5\r\n          ← 第 3 个元素长度 5
  Redis\r\n       ← 第 3 个元素

服务端响应：
  +OK\r\n         ← 简单字符串
```

**💡 加分项：** RESP3（Redis 6.0+）新增了更多数据类型：Map、Set、Null、Boolean、Double 等，让客户端不需要再猜测返回值的类型。但为了向后兼容，默认仍使用 RESP2，需要客户端主动切换（`HELLO 3`）。

---

## 七、场景设计类

### 30. 如何用 Redis 实现一个排行榜？

**🎯 面试直答版：**

用 ZSet，score 存分数，member 存用户 ID。ZADD 更新分数，ZREVRANGE 获取 Top N，ZREVRANK 获取排名。支持实时更新，查询复杂度 O(logN)。

**📖 深度解析版：**

```
需求：游戏积分排行榜，实时排名，支持查 Top N 和个人排名

数据结构设计：
  Key: leaderboard:season:2024Q1
  Score: 用户积分
  Member: 用户 ID

核心操作：
  更新分数：ZADD leaderboard:season:2024Q1 1500 user_1001
  增加分数：ZINCRBY leaderboard:season:2024Q1 100 user_1001
  Top 10：  ZREVRANGEWITHSCORES leaderboard:season:2024Q1 0 9
  个人排名：ZREVRANK leaderboard:season:2024Q1 user_1001  → 0-based
  个人分数：ZSCORE leaderboard:season:2024Q1 user_1001

进阶：分数相同时按时间排序
  问题：ZADD 的 score 相同时，按 member 的字典序排序，不是按时间
  方案：把 score 设计为 score = 分数 * 10^13 + (MAX_TIMESTAMP - 实际时间戳)
        分数高的排前面，分数相同时先达到的排前面

进阶：多维度排行榜
  方案一：多个 ZSet（周榜、月榜、总榜），通过 ZUNIONSTORE 聚合
  方案二：定时任务按不同时间维度重新计算
```

**💡 加分项：** 如果排行榜数据量巨大（亿级用户），单个 ZSet 的内存和性能可能不够。可以用分桶策略：先按分数区间分桶（0-100分一个ZSet，100-200一个），查 Top N 时从最高分桶开始查。或者用 Redis Cluster 的 Hash Tag 把排行榜分片到多个节点。

---

### 31. 如何用 Redis 实现秒杀系统中的库存扣减？

**🎯 面试直答版：**

核心思路：把库存数量放到 Redis 中，用 Lua 脚本原子性地判断库存并扣减。扣减成功后发消息到 MQ，异步更新数据库。这样 Redis 承受高并发压力，MySQL 只需要处理消息队列的有序写入。

**📖 深度解析版：**

```
秒杀扣减库存的 Lua 脚本：

  -- KEYS[1] = 库存 Key（如 seckill:stock:1001）
  -- ARGV[1] = 用户 ID
  -- ARGV[2] = 扣减数量

  -- 检查库存
  local stock = tonumber(redis.call('GET', KEYS[1]))
  if stock == nil or stock <= 0 then
      return -1  -- 库存不足
  end

  -- 检查是否重复购买（用 Set 记录已购买用户）
  local bought = redis.call('SISMEMBER', KEYS[2], ARGV[1])
  if bought == 1 then
      return -2  -- 已经买过了
  end

  -- 扣减库存
  redis.call('DECRBY', KEYS[1], ARGV[2])
  -- 记录已购买
  redis.call('SADD', KEYS[2], ARGV[1])
  return 1  -- 成功

整体架构：
  用户请求 → Nginx 限流 → 后端接口
    → 执行 Lua 脚本（原子性扣减 Redis 库存 + 去重）
    → 成功 → 发 MQ 消息（创建订单 + 扣 DB 库存）
    → 失败 → 直接返回"已售罄"

  为什么不直接操作数据库？
  ① MySQL 在高并发下扛不住（行锁竞争严重）
  ② Redis 单机可以轻松处理 10 万+ QPS
  ③ 先在 Redis 层拦截 99% 的无效请求，只有成功的才进入 MQ
```

**💡 加分项：** 库存预热很重要——秒杀开始前把库存从 DB 同步到 Redis。另外要注意超卖问题：Lua 脚本保证了 Redis 层面的原子性，但 MQ 消费者在更新 DB 时也需要做幂等处理（用订单号做唯一约束）。还有一个细节：库存回退——如果用户下单后未支付，需要在超时后把 Redis 和 DB 的库存都加回来。

---

### 32. 如何用 Redis 实现限流？

**🎯 面试直答版：**

三种方案：①固定窗口（INCR + EXPIRE，简单但有临界突刺问题）；②滑动窗口（ZSet，每个请求存时间戳，ZCOUNT 统计窗口内数量）；③令牌桶（Lua 脚本模拟令牌生成和消费，支持突发流量）。

**📖 深度解析版：**

```
方案一：固定窗口计数器
  Key: rate:user:1001:202403151030  （精确到分钟）
  每次请求 INCR → 超过阈值则拒绝
  问题：在窗口切换的临界点（如 10:30:59 和 10:31:00），
        可能在 2 秒内通过 2 倍的请求

方案二：滑动窗口（推荐，用 ZSet）
  Key: rate:user:1001
  Score: 请求时间戳（毫秒）
  Member: 请求唯一标识（UUID 或纳秒时间戳）

  Lua 脚本：
  -- 删除窗口外的旧请求
  redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
  -- 统计窗口内的请求数
  local count = redis.call('ZCARD', KEYS[1])
  if count < tonumber(ARGV[3]) then
      -- 未超限，添加本次请求
      redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
      redis.call('EXPIRE', KEYS[1], ARGV[2] / 1000)
      return 1
  else
      return 0
  end

方案三：令牌桶（适合允许突发流量的场景）
  用 Redis 存储：上次生成令牌的时间、当前令牌数
  每次请求时用 Lua 脚本计算经过的时间，生成对应的令牌，再消费一个
  优点：允许一定程度的突发流量（桶里积攒的令牌）
```

**💡 加分项：** 生产环境中更推荐用 Redisson 的 `RRateLimiter`（基于令牌桶算法），或者 Spring Cloud Gateway 自带的 `RequestRateLimiter`（基于 Redis + Lua 实现的令牌桶）。自己造轮子容易出 Bug。

---

### 33. 如何用 Redis 实现分布式 Session？

**🎯 面试直答版：**

用 Spring Session + Redis，引入 `spring-session-data-redis` 依赖，加 `@EnableRedisHttpSession` 注解。Session 自动存到 Redis，所有服务实例共享，用户请求到任何实例都能读到 Session。

**📖 深度解析版：**

```java
// 第一步：引入依赖
// spring-boot-starter-data-redis（已有）
// spring-session-data-redis

// 第二步：配置
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800)  // Session 30 分钟过期
public class SessionConfig {
    // Spring Session 会自动把 HttpSession 存储到 Redis
    // Key 格式：spring:session:sessions:<sessionId>
    // 底层用 Hash 存储 Session 的所有属性
}

// 第三步：正常使用 HttpSession，跟单机一模一样
@RestController
public class LoginController {

    @PostMapping("/login")
    public String login(HttpSession session, @RequestBody LoginRequest req) {
        // 验证用户名密码...
        User user = userService.login(req);

        // 存 Session（自动存到 Redis）
        session.setAttribute("currentUser", user);
        return "登录成功";
    }

    @GetMapping("/me")
    public User getCurrentUser(HttpSession session) {
        // 读 Session（自动从 Redis 读）
        return (User) session.getAttribute("currentUser");
    }
}
```

```
Redis 中存储的结构：
  spring:session:sessions:<sessionId>     ← Hash，存 Session 数据
  spring:session:expirations:<timestamp>  ← Set，用于定时清理过期 Session
  spring:session:sessions:expires:<id>    ← String，用于 Session 过期判断

为什么不用 JWT 替代 Session？
  JWT：无状态，不需要 Redis，但 Token 无法主动失效（退出登录难处理）
  Session + Redis：有状态，需要 Redis，但可以随时让 Session 失效
  选型：需要主动踢人、强制下线 → Session + Redis
        追求无状态、跨域方便 → JWT（配合 Redis 黑名单实现失效）
```

**💡 加分项：** 如果同时有 Web 端和 App 端，可以用 Token（如 UUID）+ Redis 的方式替代 HttpSession，更灵活：登录时生成 Token 存入 Redis（`Token → UserId`），每次请求在 Header 中带 Token，后端从 Redis 查询用户信息。这本质上是自己实现了一套轻量级 Session。

---

## 附录：快速回忆清单

```
Redis 为什么快？       → 内存 + 单线程 + IO 多路复用 + 精巧数据结构
持久化怎么选？         → 混合持久化（RDB + AOF），生产首选
缓存三大问题？         → 穿透(查不存在) / 雪崩(大量过期) / 击穿(热Key过期)
缓存一致性？           → 先更新DB，再删缓存 + TTL兜底
分布式锁？             → 生产用Redisson，别自己实现
为什么用跳表不用红黑树？→ 范围查询简单 + 实现简单
渐进式rehash？         → 每次请求搬一个桶，不阻塞
淘汰策略怎么选？       → 纯缓存用 allkeys-lru，混合用 volatile-lru
Cluster 分片原理？     → 16384 个 Hash Slot，CRC16(key) % 16384
哨兵 vs Cluster？      → 小规模用哨兵，大规模用 Cluster
多线程？               → 6.0+ 网络IO多线程，命令执行仍单线程
```
