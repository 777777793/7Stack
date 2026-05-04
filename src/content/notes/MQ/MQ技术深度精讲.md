# 消息队列（MQ）技术深度精讲

> 以 RabbitMQ 为主线，Java 生态视角，深入原理而非浅尝辄止。

---

## 一、消息模型：两种基础范式

### 1.1 点对点模型（Point-to-Point）

**类比：快递柜**

你在快递柜里放了一个包裹，只有一个人能把它取走。取走就没了，不会有第二个人拿到同一个包裹。

```
生产者 ──────► 【 Queue 队列 】 ──────► 消费者A（取走了）
                                    ✗ 消费者B（没份了）
```

**核心特征：**

| 特征 | 说明 |
|------|------|
| 消费语义 | 一条消息只被一个消费者消费 |
| 竞争消费 | 多个消费者监听同一队列时，消息被轮询分发 |
| 应用场景 | 任务分发、订单处理、异步解耦 |

在 RabbitMQ 中，**默认行为就是点对点**：多个 Consumer 绑定同一个 Queue，消息以 Round-Robin 方式分发。

---

### 1.2 发布/订阅模型（Pub/Sub）

**类比：广播站**

广播站播放音乐，所有调到这个频道的收音机都能收到相同的内容。一份信号，多份接收。

```
                          ┌──► 【Queue A】──► 消费者A（收到了）
生产者 ──► 【Exchange】──┤
                          └──► 【Queue B】──► 消费者B（也收到了）
```

**RabbitMQ 的实现方式：**
- 通过 **Fanout Exchange** 绑定多个 Queue，每个 Queue 都能收到消息副本
- 每个 Queue 后面挂不同的消费者，实现广播效果

**Kafka 的实现方式：**
- 通过 **Topic + Consumer Group** 实现
- 同一个 Consumer Group 内的消费者竞争消费（点对点语义）
- 不同 Consumer Group 各自独立消费全量消息（发布订阅语义）

---

### 1.3 RabbitMQ 的模型特色

RabbitMQ 遵循 **AMQP 0-9-1** 协议，它在生产者和队列之间多加了一层 **Exchange（交换机）**，这是和 Kafka 最本质的区别。

**完整架构图：**

```
┌─────────────────────────────────────────────────────────────────┐
│                        RabbitMQ Broker                          │
│                                                                 │
│  ┌──────────┐    ┌───────────┐   Binding    ┌──────────┐       │
│  │ Producer │───►│  Exchange  │─────────────►│  Queue 1 │──►Consumer A
│  └──────────┘    │           │   key="order" └──────────┘       │
│       │          │  (Direct/ │                                  │
│       │          │   Topic/  │   Binding    ┌──────────┐       │
│  Connection      │   Fanout/ │─────────────►│  Queue 2 │──►Consumer B
│  (TCP)           │   Headers)│   key="pay"  └──────────┘       │
│       │          └───────────┘                                  │
│       │                                                         │
│  Channel 1 ──────►  路由决策在 Exchange 层完成                    │
│  Channel 2 ──────►  Queue 只负责存储和投递                        │
│  Channel N                                                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Mnesia DB: 存储 Exchange/Queue/Binding 等元数据          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**为什么说 RabbitMQ 比 Kafka 更灵活？**

| 对比维度 | RabbitMQ | Kafka |
|---------|----------|-------|
| 路由层 | Exchange 提供丰富路由策略（Direct/Topic/Fanout/Headers） | 只有 Topic + Partition，路由能力有限 |
| 消息过滤 | Broker 端通过 routing key 和 binding 完成 | 消费端自行过滤 |
| 模型灵活性 | 同一个 Exchange 可以绑定任意多个 Queue，路由规则随意组合 | Topic 的 Partition 数量创建后难以变更 |
| 适用场景 | 复杂路由、业务系统解耦 | 高吞吐日志流、事件流 |

> **一句话总结：** RabbitMQ 的 Exchange 路由层让它在"消息怎么分发"这件事上远比 Kafka 灵活，但 Kafka 的 Partition 模型天然适合大规模顺序流处理。

---

## 二、RabbitMQ 架构深度拆解

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RabbitMQ Node (Erlang VM)                      │
│                                                                         │
│  ┌─────────┐   TCP    ┌────────────┐                                   │
│  │Producer │────────►│ Connection │                                    │
│  └─────────┘          │  (AMQP)    │                                   │
│                       └─────┬──────┘                                   │
│                             │                                           │
│              ┌──────────────┼──────────────┐                           │
│              ▼              ▼              ▼                            │
│        ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│        │Channel 1 │  │Channel 2 │  │Channel N │   (轻量虚拟连接)       │
│        └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
│             │              │              │                             │
│             ▼              ▼              ▼                             │
│        ┌──────────────────────────────────────┐                        │
│        │           Exchange Layer              │                        │
│        │  ┌────────┐ ┌───────┐ ┌──────────┐  │                        │
│        │  │ Direct │ │ Topic │ │  Fanout  │  │                        │
│        │  └────────┘ └───────┘ └──────────┘  │                        │
│        └──────────────┬───────────────────────┘                        │
│                       │ Binding Rules                                  │
│                       ▼                                                 │
│        ┌──────────────────────────────────────┐                        │
│        │           Queue Layer                 │                        │
│        │  ┌─────────┐  ┌─────────┐            │                        │
│        │  │ Queue A │  │ Queue B │  ...       │                        │
│        │  └────┬────┘  └────┬────┘            │                        │
│        └───────┼────────────┼─────────────────┘                        │
│                │            │                                           │
│  ┌─────────────────────────────────────────────┐                       │
│  │         Message Store (持久化层)              │                       │
│  │  msg_store_persistent │ msg_store_transient  │                       │
│  │  queue_index (队列索引)                       │                       │
│  └─────────────────────────────────────────────┘                       │
│                                                                         │
│  ┌──────────────────┐  ┌───────────────────────┐                       │
│  │  Mnesia Database │  │  Management Plugin    │                       │
│  │  (元数据存储)      │  │  (HTTP API + Web UI) │                       │
│  └──────────────────┘  └───────────────────────┘                       │
│                                                                         │
│  ┌─────────────────────────────────────────────┐                       │
│  │  Flow Control / Memory Alarm / Disk Alarm   │                       │
│  └─────────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
    Consumer A                           Consumer B
```

---

### 2.2 Connection 与 Channel 的关系

**类比：高速公路与车道**

Connection 就像一条高速公路（TCP 连接），修建成本很高。Channel 就像高速公路上的车道，在同一条高速公路上开辟多条车道，成本几乎为零。

```
┌───────────────────────────────────────────┐
│            TCP Connection（高速公路）         │
│                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │Channel 1│ │Channel 2│ │Channel 3│    │
│  │ (车道1)  │ │ (车道2)  │ │ (车道3)  │    │
│  └─────────┘ └─────────┘ └─────────┘    │
│                                           │
│  每条车道独立工作，互不干扰                    │
│  但它们共享同一条高速公路的带宽               │
└───────────────────────────────────────────┘
```

**为什么这样设计？**

| 维度 | Connection（TCP连接） | Channel（虚拟连接） |
|------|----------------------|---------------------|
| 创建成本 | 高：TCP三次握手 + AMQP握手 | 低：仅需协议层协商 |
| 系统资源 | 占用文件描述符、内核缓冲区 | 仅占少量内存 |
| 数量建议 | 每个应用 1-2 个 | 每个线程一个 |
| 线程安全 | 是 | **否（这是一个关键陷阱）** |

**Java 代码：正确的 Connection/Channel 使用方式**

```java
// ==========================================
// 为什么不是每次发消息都创建新的 Connection？
// 因为 TCP 连接的三次握手 + AMQP 协议握手非常昂贵
// 一个应用通常只需要 1 个 Connection
// ==========================================

public class RabbitMQConnectionManager {

    private final Connection connection;

    // ThreadLocal 保证每个线程有自己的 Channel
    // 为什么用 ThreadLocal？因为 Channel 不是线程安全的！
    // 如果多个线程共享一个 Channel，会导致帧交错（frame interleaving）
    private final ThreadLocal<Channel> channelHolder = ThreadLocal.withInitial(() -> {
        try {
            return connection.createChannel();
        } catch (IOException e) {
            throw new RuntimeException("Failed to create channel", e);
        }
    });

    public RabbitMQConnectionManager(String host) throws Exception {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost(host);

        // 设置自动恢复：连接断开后自动重连
        // 生产环境必开，否则网络抖动会导致整个服务不可用
        factory.setAutomaticRecoveryEnabled(true);
        factory.setNetworkRecoveryInterval(5000); // 5秒重试间隔

        // 只创建一个连接，复用给所有线程
        this.connection = factory.newConnection();
    }

    public Channel getChannel() {
        return channelHolder.get();
    }

    // Spring AMQP 中的做法更优雅：
    // CachingConnectionFactory 内部维护了 Channel 缓存池
    // 用完的 Channel 不关闭，而是放回池中复用
}
```

```java
// ==========================================
// Spring Boot 中的推荐配置（底层自动管理）
// ==========================================
// application.yml
// spring:
//   rabbitmq:
//     host: localhost
//     port: 5672
//     cache:
//       channel:
//         size: 25          # Channel 缓存池大小
//         checkout-timeout: 0 # 0=无限等待，>0=超时抛异常
//       connection:
//         mode: CHANNEL     # 只缓存 Channel，共享 Connection
```

> **一句话总结：** Connection 是昂贵的 TCP 公路，Channel 是廉价的虚拟车道；一个应用一条公路，每个线程一条车道，绝不跨线程共用车道。

---

### 2.3 Exchange 路由机制详解

Exchange 是 RabbitMQ 最核心的设计，它决定了消息"往哪走"。理解 Exchange 就理解了 RabbitMQ 的灵魂。

#### 2.3.1 Direct Exchange（直连交换机）

**类比：快递分拣中心**

每个包裹上写着收件地址（routing key），分拣员严格按地址把包裹丢进对应的投递箱（queue）。地址必须完全匹配，差一个字都不行。

```
                          routing_key = "order"
Producer ──────────────────────────────────────►┐
  msg(key="order")                              │
                                                ▼
                        ┌─────────────── Direct Exchange ──────────────┐
                        │                                              │
                        │   路由表（Binding Table）：                    │
                        │   ┌─────────────────┬──────────────┐        │
                        │   │  Routing Key    │  Target Queue │        │
                        │   ├─────────────────┼──────────────┤        │
                        │   │  "order"        │  order_queue  │        │
                        │   │  "payment"      │  pay_queue    │        │
                        │   │  "notification" │  notify_queue │        │
                        │   └─────────────────┴──────────────┘        │
                        │                                              │
                        │   匹配规则：routing_key == binding_key        │
                        │   时间复杂度：O(1) 哈希查找                    │
                        └──────────────────────────────────────────────┘
                                        │
                          routing_key = "order" → 精确匹配
                                        │
                                        ▼
                                 ┌─────────────┐
                                 │ order_queue  │──► Consumer
                                 └─────────────┘
```

**内部实现：** Direct Exchange 内部维护一个 `Map<RoutingKey, List<Queue>>` 的哈希表，所以路由速度是 O(1)。

---

#### 2.3.2 Topic Exchange（主题交换机）

**类比：报纸订阅**

你可以订阅"体育.*"（所有体育新闻），也可以订阅"#.紧急"（任何类别的紧急新闻）。`*` 匹配一个词，`#` 匹配零到多个词。

```
生产者发送的消息：
  msg1: routing_key = "order.create"
  msg2: routing_key = "order.pay.success"
  msg3: routing_key = "user.register"

                    ┌─────────────── Topic Exchange ───────────────────┐
                    │                                                   │
                    │  Binding 规则：                                    │
                    │                                                   │
                    │  "order.*"     ──► queue_order_simple             │
                    │  "order.#"     ──► queue_order_all                │
                    │  "*.register"  ──► queue_register                 │
                    │  "#"           ──► queue_audit (审计队列，收所有)   │
                    │                                                   │
                    └───────────────────────────────────────────────────┘

匹配结果：
  msg1 (order.create):
    ✓ order.*       → queue_order_simple（* 匹配 create 这一个词）
    ✓ order.#       → queue_order_all  （# 匹配 create）
    ✗ *.register    → 不匹配
    ✓ #             → queue_audit

  msg2 (order.pay.success):
    ✗ order.*       → 不匹配！（* 只能匹配一个词，这里有 pay.success 两个词）
    ✓ order.#       → queue_order_all  （# 匹配 pay.success 零到多个词）
    ✗ *.register    → 不匹配
    ✓ #             → queue_audit

  msg3 (user.register):
    ✗ order.*       → 不匹配
    ✗ order.#       → 不匹配
    ✓ *.register    → queue_register （* 匹配 user 这一个词）
    ✓ #             → queue_audit
```

**关键区别：`*` vs `#`**

```
order.*   → 只匹配两级：order.create ✓  order.pay.success ✗
order.#   → 匹配任意级：order.create ✓  order.pay.success ✓  order ✓
```

**内部实现：Trie 树匹配**

Topic Exchange 内部使用 Trie（前缀树）来组织 binding pattern，每个 `.` 分隔的词是树的一级节点。匹配时从根节点开始遍历。

```
                        [root]
                       /      \
                    order      *
                   /    \       \
                  *      #    register
                  │      │       │
            queue_simple │    queue_register
                   queue_all
```

**性能注意事项：**
- Binding 数量超过几千条时，Topic Exchange 的路由性能会明显下降
- `#` 通配符比 `*` 更耗性能（需要遍历更多分支）
- 如果不需要通配符，用 Direct Exchange，路由速度快一个数量级

---

#### 2.3.3 Fanout Exchange（扇出交换机）

**类比：群发短信**

不看内容，不看地址，直接发给所有绑定的队列。简单粗暴，也因此最快。

```
                        ┌──────── Fanout Exchange ────────┐
                        │                                  │
Producer ─────────────► │  不看 routing_key                │
  msg(key="任意值")     │  遍历所有 Binding，逐个投递       │
                        │                                  │
                        │  bindings: [Q1, Q2, Q3]         │
                        └───┬──────────┬──────────┬────────┘
                            │          │          │
                            ▼          ▼          ▼
                         Queue1     Queue2     Queue3
                            │          │          │
                            ▼          ▼          ▼
                        Consumer A  Consumer B  Consumer C
                        (全都收到相同的消息)
```

**内部实现：** 直接遍历 `List<Queue>`，无需任何键匹配运算，所以是**三种常用 Exchange 中最快的**。

**典型场景：**
- 广播通知（如配置变更通知所有服务）
- 日志广播（同一条日志同时存 ES、写文件、发告警）

---

#### 2.3.4 Headers Exchange（头信息交换机）

根据消息的 header 属性进行匹配，而不是 routing key。通过 `x-match` 参数控制：
- `x-match: all` — 所有 header 键值对都匹配才路由
- `x-match: any` — 任一 header 键值对匹配就路由

**实际使用极少**，因为性能不如 Direct/Topic，灵活性也没有想象中高。知道存在即可。

---

**四种 Exchange 性能对比：**

```
路由速度排名：Fanout > Direct > Topic > Headers

Fanout  : O(N)  N=绑定队列数，无需匹配运算
Direct  : O(1)  哈希表直接命中
Topic   : O(M)  M=pattern复杂度，Trie 树遍历
Headers : O(K)  K=header 键值对数量
```

> **一句话总结：** Exchange 是 RabbitMQ 的路由大脑 -- Direct 精确匹配最实用，Topic 通配符最灵活，Fanout 广播最快速；选型时先问自己"消息需要怎么分发"。

---

### 2.4 消息存储机制

**类比：图书馆藏书系统**

- **Mnesia 数据库** = 图书馆的目录卡片（存储 Exchange、Queue、Binding 这些"元数据"）
- **Message Store** = 书库中的书架（真正存放消息内容）
- **Queue Index** = 每本书的位置编号（记录消息在 Queue 中的位置 → 对应书架上的哪个位置）

```
┌─────────────────── RabbitMQ 存储架构 ───────────────────┐
│                                                          │
│  ┌──────────────────────────────────┐                   │
│  │         Mnesia Database          │                   │
│  │  - Exchange 定义                  │                   │
│  │  - Queue 定义                     │                   │
│  │  - Binding 关系                   │                   │
│  │  - 用户权限                       │                   │
│  │  (集群内所有节点同步复制)            │                   │
│  └──────────────────────────────────┘                   │
│                                                          │
│  ┌──────────────────────────────────┐                   │
│  │      Message Store（消息存储）     │                   │
│  │                                  │                   │
│  │  msg_store_persistent/           │ ← 持久化消息       │
│  │    ├── 0.rdq  (segment file)     │   deliveryMode=2  │
│  │    ├── 1.rdq                     │                   │
│  │    └── ...                       │                   │
│  │                                  │                   │
│  │  msg_store_transient/            │ ← 非持久化消息     │
│  │    ├── 0.rdq                     │   deliveryMode=1  │
│  │    └── ...                       │                   │
│  └──────────────────────────────────┘                   │
│                                                          │
│  ┌──────────────────────────────────┐                   │
│  │       Queue Index（队列索引）      │                   │
│  │                                  │                   │
│  │  记录每条消息在队列中的位置         │                   │
│  │  (seq_id) → 指向 Message Store   │                   │
│  │  中的具体消息                     │                   │
│  │                                  │                   │
│  │  小消息(< 4096B)直接嵌入索引      │                   │
│  │  大消息只在索引中存引用            │                   │
│  └──────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

**持久化消息的完整生命周期：**

```
消息到达 Broker
      │
      ▼
  ① 写入 Message Store 文件（.rdq）
      │
      ▼
  ② 更新 Queue Index（记录位置映射）
      │
      ▼
  ③ 消息在内存中也保留一份（加速读取）
      │
      ▼
  ④ 如果内存压力大 → 把内存中的消息 Page Out 到磁盘
      │                 （只保留 Queue Index 引用）
      ▼
  ⑤ 消费者消费后 → 标记删除 → GC 回收空间
```

**Lazy Queue（惰性队列）：**

普通队列：消息先存内存，内存不够才刷盘（内存优先策略）。
惰性队列：消息直接写磁盘，消费时再从磁盘读（磁盘优先策略）。

```
普通 Queue:  Producer → [内存] → Consumer     (快，但内存占用大)
                          ↓
                      内存不够时
                          ↓
                        [磁盘]

Lazy Queue:  Producer → [磁盘] → Consumer     (慢一点，但能堆积百万级消息)
```

**什么时候用 Lazy Queue？**
- 队列可能积压大量消息（如下游消费者临时下线）
- 宁可牺牲一点延迟，也不希望 Broker 被撑爆
- RabbitMQ 3.12+ 推荐直接使用 **Quorum Queue**，它融合了 Lazy Queue 的优点并提供更强的数据安全保证

> **一句话总结：** RabbitMQ 用 Mnesia 存元数据，用 Message Store 存消息体，用 Queue Index 做位置映射；小消息嵌入索引加速，大消息引用存储节省空间；Lazy Queue 用磁盘换内存，适合大量积压场景。

---

### 2.5 内存管理与流控机制

**类比：水库泄洪**

水库（Broker）有个最高水位线（memory watermark）。水位超过警戒线，就关闭上游闸门（阻塞 Publisher），防止溃坝（OOM）。

```
                    vm_memory_high_watermark = 0.4
                    （默认：物理内存的 40%）

内存使用率:
 100% ┤ ████████████████████████████████████  ← OOM 崩溃
      │
  40% ┤ ═══════════════════ ← 水位线（触发 Flow Control）
      │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ← 正常运行区间
      │ ▓▓▓▓▓▓▓▓▓▓
   0% ┤ ▓▓▓▓▓
      └──────────────────────────────── 时间

当内存使用超过 40%:
  → Publisher 被阻塞（Connection 状态变为 "blocked"）
  → Consumer 继续消费（排水）
  → 内存降回 40% 以下后，Publisher 恢复
```

**三层保护机制：**

| 保护层 | 触发条件 | 行为 | 默认值 |
|--------|---------|------|--------|
| Memory Alarm | 内存超过 watermark | 阻塞所有 Publisher | 0.4 (40%) |
| Disk Alarm | 可用磁盘低于阈值 | 阻塞所有 Publisher | 50MB |
| Credit-based Flow Control | 内部进程间流量不均衡 | 上游进程暂停发送 | 自动调节 |

**Credit-based Flow Control 详解：**

这是 RabbitMQ 内部进程之间的背压机制。每个上游进程有一定"信用额度"（credit），每发一条消息扣一点信用，下游处理完补回信用。信用耗尽则上游暂停。

```
Producer Process ──(credit: 200)──► Channel Process ──(credit: 200)──► Queue Process
                                         │
                                 信用耗尽时暂停发送
                                 下游处理完消息后补充信用
```

**生产环境推荐配置：**

```ini
# /etc/rabbitmq/rabbitmq.conf

# 内存水位线：可用内存的 40%（默认值，通常不需要改）
# 如果 Broker 机器还跑其他服务，可以调低到 0.3
vm_memory_high_watermark.relative = 0.4

# 另一种方式：设置绝对值（适合容器环境）
# vm_memory_high_watermark.absolute = 2GB

# 内存分页阈值：达到水位线的 50% 时开始把消息从内存刷到磁盘
# 这是一个"预警线"，提前刷盘避免突然触发 Flow Control
vm_memory_high_watermark_paging_ratio = 0.5

# 磁盘空间下限：可用磁盘空间低于此值时阻塞 Publisher
# 至少设置为消息数据量的 1.5 倍
disk_free_limit.relative = 1.5
# 或者设置绝对值
# disk_free_limit.absolute = 2GB
```

> **一句话总结：** RabbitMQ 通过内存水位线、磁盘报警和信用流控三层机制保护自己不被撑爆，核心思路是"上游太快就让上游等一等"。

---

## 三、消息可靠性：三段式保障

消息从生产到消费，经过三段路程，每一段都可能丢消息：

```
  生产端              Broker 端              消费端
  ┌────┐   可能丢①   ┌────────┐   可能丢②   ┌────┐
  │生产者│───────────►│  Broker │───────────►│消费者│
  └────┘   网络故障   │  Queue │   消费者宕机  └────┘
           路由失败   │  持久化 │   未 ack
                     └────────┘   处理异常
                      可能丢③
                     Broker 宕机
                     磁盘故障
```

### 3.1 生产端可靠性

#### Publisher Confirm 机制深度解析

**类比：挂号信**

普通信寄出去不知道对方收没收到。挂号信会收到一个回执，告诉你"已签收"。Publisher Confirm 就是消息的回执单。

**内部工作流：**

```
Producer                    Broker
   │                          │
   │  1. channel.confirmSelect()
   │─────────────────────────►│  开启 Confirm 模式
   │                          │
   │  2. basicPublish(msg)    │
   │─────────────────────────►│
   │                          │  3. Exchange 路由到 Queue
   │                          │  4. 消息持久化到磁盘（如果是持久化消息）
   │                          │  5. 如果是镜像/仲裁队列，等副本写入
   │                          │
   │  6. basic.ack(deliveryTag=1)
   │◄─────────────────────────│  Broker 确认：消息已安全存储
   │                          │
   │  或者                     │
   │  basic.nack(deliveryTag=1)
   │◄─────────────────────────│  Broker 否认：处理失败
```

**三种确认模式对比与代码：**

```java
// ==========================================
// 模式一：单条同步确认（最慢，但最简单）
// 每发一条就等一条确认，像排队一个一个过安检
// 适用：消息量极小，可靠性要求极高
// ==========================================
public void syncConfirmOneByOne(Channel channel) throws Exception {
    channel.confirmSelect(); // 开启 confirm 模式

    for (int i = 0; i < 1000; i++) {
        String message = "msg-" + i;
        channel.basicPublish("exchange", "routingKey",
            MessageProperties.PERSISTENT_TEXT_PLAIN, message.getBytes());

        // 阻塞等待 Broker 确认这一条消息
        // 为什么慢？因为每条消息都要等一个网络往返 RTT
        // 1000条消息 × 1ms RTT = 至少1秒，实际更慢
        boolean confirmed = channel.waitForConfirms(5000);
        if (!confirmed) {
            // 处理失败：重发或记录日志
            System.err.println("Message not confirmed: " + message);
        }
    }
}

// ==========================================
// 模式二：批量同步确认（中等速度）
// 攒一批再等确认，像一群人一起过安检
// 问题：如果这批里有一条失败了，整批都要重发
// ==========================================
public void syncConfirmBatch(Channel channel) throws Exception {
    channel.confirmSelect();
    int batchSize = 100;
    int unconfirmedCount = 0;

    for (int i = 0; i < 1000; i++) {
        String message = "msg-" + i;
        channel.basicPublish("exchange", "routingKey",
            MessageProperties.PERSISTENT_TEXT_PLAIN, message.getBytes());
        unconfirmedCount++;

        if (unconfirmedCount >= batchSize) {
            // 等待这一批全部确认
            boolean allConfirmed = channel.waitForConfirms(5000);
            if (!allConfirmed) {
                // 致命问题：不知道哪条失败了，只能整批重发
                System.err.println("Batch not fully confirmed, need to resend");
            }
            unconfirmedCount = 0;
        }
    }
}

// ==========================================
// 模式三：异步确认（最快，生产环境推荐）
// 发消息和收确认是两条独立的线，互不阻塞
// 像快递寄出后继续工作，快递签收短信异步通知你
// ==========================================
public void asyncConfirm(Channel channel) throws Exception {
    channel.confirmSelect();

    // 用 ConcurrentSkipListMap 记录所有未确认的消息
    // 为什么用 SkipListMap 而不是 HashMap？
    // 因为 Broker 可能批量确认（multiple=true），需要快速清除
    // "所有 <= deliveryTag 的消息"，SkipListMap 的 headMap 操作是 O(logN)
    ConcurrentNavigableMap<Long, String> outstandingConfirms =
        new ConcurrentSkipListMap<>();

    // 注册确认回调
    channel.addConfirmListener(
        // ack 回调：消息被 Broker 成功处理
        (deliveryTag, multiple) -> {
            if (multiple) {
                // multiple=true：deliveryTag 及之前的所有消息都确认了
                // headMap 返回 key < deliveryTag+1 的所有条目
                ConcurrentNavigableMap<Long, String> confirmed =
                    outstandingConfirms.headMap(deliveryTag + 1);
                confirmed.clear(); // 批量清除
            } else {
                // 只确认单条
                outstandingConfirms.remove(deliveryTag);
            }
        },
        // nack 回调：消息被 Broker 拒绝
        (deliveryTag, multiple) -> {
            String failedMessage = outstandingConfirms.get(deliveryTag);
            System.err.println("Message nacked: " + failedMessage);
            // 处理策略：重发、写入本地日志、存入数据库待重试
            // 注意：不要在回调里直接 basicPublish，容易死锁
            // 建议放入重试队列，由独立线程处理
            if (multiple) {
                outstandingConfirms.headMap(deliveryTag + 1).clear();
            } else {
                outstandingConfirms.remove(deliveryTag);
            }
        }
    );

    // 发送消息（不阻塞等待确认）
    for (int i = 0; i < 10000; i++) {
        String message = "msg-" + i;
        // getNextPublishSeqNo() 返回下一条消息的 deliveryTag
        long seqNo = channel.getNextPublishSeqNo();
        outstandingConfirms.put(seqNo, message);

        channel.basicPublish("exchange", "routingKey",
            MessageProperties.PERSISTENT_TEXT_PLAIN, message.getBytes());
        // 不等待！继续发下一条！
    }
}
```

**三种模式性能对比：**

```
发送 10000 条消息耗时：

单条同步确认:  ████████████████████████████████████  ~12s
批量同步确认:  █████████                              ~3s
异步确认:      ██                                     ~0.8s
```

#### Publisher Return 机制

当消息发到了 Exchange，但 Exchange 找不到匹配的 Queue 时会发生什么？

默认行为：**消息被静默丢弃！** 这在生产环境是不可接受的。

```java
// mandatory=true：如果消息无法路由到任何队列，Broker 会将消息返回给 Producer
// 而不是静默丢弃
channel.addReturnListener((replyCode, replyText, exchange, routingKey,
                           properties, body) -> {
    // 消息无法路由时的处理
    String msg = new String(body);
    System.err.println("Message returned: " + msg
        + ", exchange=" + exchange
        + ", routingKey=" + routingKey
        + ", reason=" + replyText);
    // 处理策略：
    // 1. 记录日志，人工排查为什么路由失败
    // 2. 检查 binding 配置是否正确
    // 3. 发送到备用队列
});

// 发送时设置 mandatory=true
channel.basicPublish("exchange", "non.existent.key",
    true,  // mandatory: 无法路由时退回，而不是丢弃
    MessageProperties.PERSISTENT_TEXT_PLAIN,
    "important message".getBytes());
```

**完整的消息发布可靠性流程：**

```
Producer                        Broker
   │                              │
   │  basicPublish(mandatory=true) │
   │──────────────────────────────►│
   │                              │
   │                     Exchange 路由判断
   │                        ┌─────┴─────┐
   │                        │           │
   │                     有匹配Queue  无匹配Queue
   │                        │           │
   │                     投递到Queue  mandatory=true?
   │                        │        ┌──┴──┐
   │                     持久化      Yes    No
   │                        │        │     │
   │  basic.ack             │  basic.return │
   │◄───────────────────────┘  (退回消息)   丢弃
   │                        │        │
   │                        │  basic.ack
   │◄───────────────────────┘  (退回之后也会 ack，
   │                           deliveryTag 已分配)
```

> **一句话总结：** Publisher Confirm 保证消息到达 Broker，Publisher Return 保证消息能路由到 Queue；异步确认 + mandatory 是生产环境的标配组合。

---

### 3.2 Broker 端可靠性

消息到了 Broker 不代表安全了。Broker 宕机、磁盘坏了，消息照样丢。

**第一道防线：持久化**

```java
// 队列持久化：Broker 重启后队列还在
// durable=true 只是保证队列定义不丢，消息本身还需要单独持久化！
channel.queueDeclare("my_queue",
    true,   // durable: 队列持久化
    false,  // exclusive: 非排他
    false,  // autoDelete: 不自动删除
    null);

// 消息持久化：消息写入磁盘
AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
    .deliveryMode(2) // 2=持久化，1=非持久化
    .build();

channel.basicPublish("exchange", "routingKey", props, "data".getBytes());

// ⚠️ 常见误区：只设置了 durable=true 没设置 deliveryMode=2
// 结果：队列重启后还在，但里面的消息全丢了！
// 必须 两者都设置 才能真正持久化
```

**第二道防线：多节点复制**

| 特性 | Classic Mirrored Queue | Quorum Queue (推荐) |
|------|----------------------|---------------------|
| 复制协议 | Erlang 原生 GM (Guaranteed Multicast) | Raft 共识协议 |
| 一致性 | 最终一致 | 强一致 (多数派写入才确认) |
| 脑裂处理 | 手动处理 | 自动 (Raft leader 选举) |
| 性能 | 低负载下略快 | 高负载下更稳定 |
| 数据安全 | Leader 挂了可能丢数据 | 多数派存活就不丢 |
| 消息堆积 | 需要手动配 lazy queue | 内建高效磁盘存储 |
| 运维复杂度 | 高（需关注同步状态） | 低（自动选举、自动恢复） |
| RabbitMQ 版本 | 3.x 全支持 | 3.8+ 引入，推荐 3.10+ |

```java
// 声明 Quorum Queue
Map<String, Object> args = new HashMap<>();
args.put("x-queue-type", "quorum");

// Quorum Queue 自带持久化，不需要也不能设置 durable=false
channel.queueDeclare("my_quorum_queue",
    true,   // Quorum Queue 必须 durable=true
    false,  // 不能是 exclusive
    false,  // 不能 autoDelete
    args);
```

**消息什么时候才是真正"安全"的？**

```
                    Quorum Queue (3节点)

Producer ──► Leader Node ──► 写入本地日志
                  │
                  ├──► Follower 1 ──► 写入本地日志  ✓
                  │
                  └──► Follower 2 ──► 写入本地日志  ✓ (多数派写入完成)
                  │
                  │  此时才向 Producer 发送 basic.ack
                  │  （2/3 节点写入成功 = 多数派确认）
                  ▼
             Producer 收到 ack → 消息安全了
```

> **一句话总结：** 持久化保证单机不丢，Quorum Queue 保证集群不丢；"队列持久化 + 消息持久化 + 多数派写入"三者缺一不可。

---

### 3.3 消费端可靠性

**类比：签收快递**

Auto Ack = 快递员把快递放门口就标记"已签收"（你可能还没拿到）
Manual Ack = 你亲手签字后才标记"已签收"（确保你真的拿到了）

```
生产环境必须用 Manual Ack！原因：

Auto Ack 的灾难场景：
  Broker ──发送消息──► Consumer
                       │
                    立刻标记已消费（从队列移除）
                       │
                    处理消息中...
                       │
                    处理到一半，Consumer 挂了 💥
                       │
                    消息丢了！Broker 已经删了！

Manual Ack 的安全场景：
  Broker ──发送消息──► Consumer
                       │
                    处理消息中...（Broker 标记为 unacked）
                       │
                    处理到一半，Consumer 挂了 💥
                       │
                    Broker 发现连接断了，unacked 消息重新入队
                       │
                    另一个 Consumer 重新消费这条消息 ✓
```

**三种应答方式：**

| 方式 | 作用 | 场景 |
|------|------|------|
| `basicAck` | 确认成功消费 | 正常处理完毕 |
| `basicNack` | 否定确认，可批量，可选是否重新入队 | 处理失败 |
| `basicReject` | 拒绝单条消息，可选是否重新入队 | 消息格式错误等 |

**Prefetch Count（QoS 预取数量）的重要性：**

```
不设置 Prefetch（默认无限）的灾难：

Broker 中有 100 万条消息
    │
    │  一口气全推给 Consumer1
    ▼
Consumer1 内存爆炸 💥 OOM

设置 Prefetch = 10：

Broker 中有 100 万条消息
    │
    │  只推 10 条给 Consumer
    │  Consumer 处理完 1 条 ack 后
    │  Broker 再推 1 条
    ▼
Consumer 内存平稳运行 ✓
```

**完整的可靠消费者代码：**

```java
public class ReliableConsumer {

    public void startConsuming(Channel channel, String queueName) throws IOException {

        // 设置 Prefetch Count
        // 为什么设置为 10 而不是 1 或 1000？
        // = 1: 最安全但吞吐量极低，Consumer 大部分时间在等网络
        // = 1000: 吞吐量高但 Consumer 内存压力大
        // = 10~50: 推荐范围，兼顾吞吐量和内存安全
        // 具体取值取决于：单条消息处理时间 × 消费者数量
        channel.basicQos(10);

        // 注意第二个参数 autoAck = false（手动确认模式）
        channel.basicConsume(queueName, false, new DefaultConsumer(channel) {
            @Override
            public void handleDelivery(String consumerTag, Envelope envelope,
                    AMQP.BasicProperties properties, byte[] body) {
                long deliveryTag = envelope.getDeliveryTag();

                try {
                    // 业务处理
                    String message = new String(body, StandardCharsets.UTF_8);
                    processMessage(message);

                    // 处理成功 → 确认
                    // multiple=false: 只确认当前这一条
                    // multiple=true: 确认 deliveryTag 及之前所有未确认的消息
                    //                （批量确认，减少网络往返，但有风险）
                    channel.basicAck(deliveryTag, false);

                } catch (BusinessRetryableException e) {
                    // 可重试的业务异常（如下游服务暂时不可用）
                    // requeue=true: 消息重新放回队列头部
                    // ⚠️ 危险：如果消息本身有问题，会无限重试！
                    // 建议：结合重试次数判断
                    int retryCount = getRetryCount(properties);
                    if (retryCount < 3) {
                        // 重新入队，但要更新重试次数（通过 header 传递）
                        channel.basicNack(deliveryTag, false, true);
                    } else {
                        // 超过重试次数，发送到死信队列
                        channel.basicNack(deliveryTag, false, false);
                    }

                } catch (BusinessFatalException e) {
                    // 不可重试的异常（如消息格式错误、业务校验不通过）
                    // requeue=false: 不重新入队
                    // 如果配置了 DLX，消息会进入死信队列
                    // 如果没配置 DLX，消息直接丢弃！
                    channel.basicReject(deliveryTag, false);

                } catch (Exception e) {
                    // 未知异常，保守处理：重新入队
                    channel.basicNack(deliveryTag, false, true);
                }
            }
        });
    }

    private int getRetryCount(AMQP.BasicProperties properties) {
        if (properties.getHeaders() == null) return 0;
        Object count = properties.getHeaders().get("x-retry-count");
        return count == null ? 0 : (int) count;
    }

    // 幂等性处理：同一条消息可能被消费多次（重新入队、网络重传等）
    // 必须保证处理逻辑的幂等性！
    private void processMessage(String message) {
        // 方案一：数据库唯一索引（天然幂等）
        // 方案二：Redis SETNX 判重
        // 方案三：业务状态机（订单状态只能单向流转）
    }
}
```

> **一句话总结：** 生产环境必须 Manual Ack + Prefetch + 幂等处理三件套，AutoAck 是消息丢失的头号杀手。

---

## 四、消息顺序性

### 4.1 为什么顺序性是个问题

**类比：微信消息**

你给朋友发了三条消息："今晚"→"一起"→"吃饭"。如果对方收到的顺序是"吃饭"→"今晚"→"一起"，语义就完全乱了。

```
正常情况（单 Queue + 单 Consumer）：
  Producer: msg1 → msg2 → msg3
  Queue:    [msg1, msg2, msg3]
  Consumer: msg1 → msg2 → msg3  ✓ 有序

多 Consumer 竞争消费（顺序被打破）：
  Producer: msg1 → msg2 → msg3
  Queue:    [msg1, msg2, msg3]
             │       │       │
             ▼       ▼       ▼
          ConsumerA ConsumerB ConsumerA
          处理msg1  处理msg2  处理msg3
          (100ms)   (10ms)   (50ms)

  完成顺序: msg2 → msg3 → msg1  ✗ 乱序！

网络重传导致乱序：
  msg1 发送失败 → 重发 → 实际到达顺序变成 msg2, msg1
```

---

### 4.2 RabbitMQ 如何保证顺序

#### 策略一：单 Queue + 单 Consumer

最简单但吞吐量最低。

```
Producer ──► [Queue] ──► 唯一的 Consumer

优点：绝对有序
缺点：吞吐量被单个消费者限制
适用：消息量小、对顺序要求严格的场景
```

#### 策略二：Consistent Hash Exchange（一致性哈希交换机）

**核心思想：** 相同业务 key 的消息总是路由到同一个 Queue，从而在局部保证顺序。

```
                     Consistent Hash Exchange

  msg(userId=1001) ──►┐                    ┌──► Queue 1 ──► Consumer A
  msg(userId=1002) ──►├──  hash(userId)  ──┤
  msg(userId=1001) ──►┤    取模分配       ──►  Queue 2 ──► Consumer B
  msg(userId=1003) ──►┘                    └──► Queue 3 ──► Consumer C

  userId=1001 的消息总是去 Queue 1 → 在 Queue 1 内部有序
  userId=1002 的消息总是去 Queue 2 → 在 Queue 2 内部有序
  不同 userId 之间不保证顺序（也不需要）
```

```java
// 需要启用插件：rabbitmq-plugins enable rabbitmq_consistent_hash_exchange

// 声明一致性哈希交换机
channel.exchangeDeclare("order_hash_exchange", "x-consistent-hash", true);

// 绑定队列时，binding key 是权重值（数字越大，分到的消息越多）
channel.queueDeclare("order_queue_1", true, false, false, null);
channel.queueDeclare("order_queue_2", true, false, false, null);
channel.queueDeclare("order_queue_3", true, false, false, null);

// 权重为 "1"：三个队列均分流量
channel.queueBind("order_queue_1", "order_hash_exchange", "1");
channel.queueBind("order_queue_2", "order_hash_exchange", "1");
channel.queueBind("order_queue_3", "order_hash_exchange", "1");

// 发送消息时，routing key 作为哈希输入
// 相同的 routing key 一定路由到同一个队列
String orderId = "ORDER_20240101_001";
channel.basicPublish("order_hash_exchange", orderId,
    MessageProperties.PERSISTENT_TEXT_PLAIN, message.getBytes());
```

#### 策略三：消费端重排序

在消费端根据消息中的序列号（sequence number）进行重排序。

```java
// 生产端：为每条消息添加业务序列号
AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
    .headers(Map.of(
        "x-business-key", "ORDER_001",  // 业务键
        "x-sequence", 3                 // 序列号
    ))
    .build();

// 消费端：基于序列号重排序
// 使用 PriorityBlockingQueue 或 TreeMap 按序列号排序
// 设置超时窗口，避免永远等待缺失的消息
```

---

### 4.3 对比 Kafka 的顺序性保证

```
Kafka 的天然优势：

Topic: order_events
  ┌──────────────┐
  │ Partition 0  │  key=userId:1001 → 所有消息在这里，天然有序
  ├──────────────┤
  │ Partition 1  │  key=userId:1002 → 所有消息在这里，天然有序
  ├──────────────┤
  │ Partition 2  │  key=userId:1003 → 所有消息在这里，天然有序
  └──────────────┘

Kafka 在 Partition 内部保证严格的追加顺序（Append-Only Log）
同一个 key 的消息通过 Partitioner 路由到同一个 Partition
不需要额外插件或手动配置
```

| 维度 | RabbitMQ | Kafka |
|------|----------|-------|
| 默认顺序性 | 单 Queue 内有序，多 Consumer 易乱序 | Partition 内严格有序 |
| 实现复杂度 | 需要哈希交换机插件或消费端重排序 | 天然支持，配置 key 即可 |
| 适用场景 | 业务系统（顺序要求不高） | 事件流、日志（顺序要求高） |
| 权衡 | 灵活但需要额外工作 | 简单但 Partition 数量固定 |

> **一句话总结：** RabbitMQ 顺序性需要靠一致性哈希交换机"把同一业务的消息赶进同一队列"来实现，Kafka 则通过 Partition Key 天然保序，这是两者模型差异的直接体现。

---

## 五、事务消息与最终一致性

### 5.1 RabbitMQ 的 TX 事务

**先说结论：几乎不要用。**

```java
// TX 事务模式的代码
try {
    channel.txSelect();   // 开启事务
    channel.basicPublish("exchange", "key", null, "msg1".getBytes());
    channel.basicPublish("exchange", "key", null, "msg2".getBytes());
    channel.txCommit();   // 提交事务：两条消息要么都发，要么都不发
} catch (Exception e) {
    channel.txRollback(); // 回滚事务
}
```

**为什么不用？性能对比：**

```
普通模式（无确认）:  ████████████████████████████████████  ~50000 msg/s
Publisher Confirm:  ██████████████████████████████       ~40000 msg/s
TX 事务模式:        █                                     ~200 msg/s

TX 事务比 Confirm 慢 250 倍！
```

原因：TX 事务每次 commit 都需要将消息 fsync 到磁盘并等待所有 Queue 确认，整个过程是同步阻塞的。而 Publisher Confirm 可以异步批量确认，完全不在一个量级。

---

### 5.2 基于 Confirm 的可靠投递方案（Outbox Pattern）

**真正的业务场景：** 数据库操作和消息发送需要保持一致性。

例如：用户下单 → 扣库存（写数据库）→ 发送消息通知物流。如果数据库写成功了但消息发送失败，物流就不知道要发货。

**本地消息表（Outbox Pattern）方案：**

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ① BEGIN Transaction                                         │
│     ├── 执行业务逻辑（扣库存、改状态...）                       │
│     └── INSERT INTO message_outbox (id, content, status)     │
│  ② COMMIT Transaction                                        │
│                                                              │
│  ─── 以上保证数据库和消息表的原子性（同一个事务） ───             │
│                                                              │
│  ③ 异步线程轮询 message_outbox 表                              │
│     ├── SELECT * FROM message_outbox WHERE status='PENDING'  │
│     ├── 发送到 RabbitMQ（with Publisher Confirm）              │
│     ├── 收到 ack → UPDATE status='SENT'                       │
│     └── 收到 nack → 保持 PENDING，下次继续重试                 │
│                                                              │
│  ④ 定时任务兜底                                               │
│     └── 清理超时未发送的消息（重试 or 告警）                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**完整代码实现：**

```java
// ==========================================
// 本地消息表 Schema
// ==========================================
/*
CREATE TABLE message_outbox (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    message_id    VARCHAR(64) NOT NULL UNIQUE,  -- 幂等键
    exchange      VARCHAR(128) NOT NULL,
    routing_key   VARCHAR(128) NOT NULL,
    payload       TEXT NOT NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'PENDING',  -- PENDING / SENT / FAILED
    retry_count   INT NOT NULL DEFAULT 0,
    create_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status_create (status, create_time)
);
*/

// ==========================================
// 业务服务：业务操作 + 消息写入同一个事务
// ==========================================
@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepo;
    @Autowired
    private MessageOutboxRepository outboxRepo;

    @Transactional  // 关键：业务和消息在同一个数据库事务中
    public void createOrder(OrderRequest request) {
        // 1. 执行业务逻辑
        Order order = new Order(request);
        orderRepo.save(order);

        // 2. 把要发送的消息写入本地消息表
        // 注意：这里 NOT 发送消息，而是存到数据库
        // 为什么？因为如果在这里直接发消息：
        //   - 消息发成功了，但后面数据库事务回滚了 → 下游收到了不该有的消息
        //   - 数据库成功了，但消息发失败了 → 下游不知道有新订单
        MessageOutbox outbox = new MessageOutbox();
        outbox.setMessageId(UUID.randomUUID().toString());
        outbox.setExchange("order.exchange");
        outbox.setRoutingKey("order.created");
        outbox.setPayload(JSON.toJSONString(new OrderCreatedEvent(order.getId())));
        outbox.setStatus("PENDING");
        outboxRepo.save(outbox);

        // 3. 事务提交后，业务数据和消息数据要么同时成功，要么同时失败
    }
}

// ==========================================
// 消息投递器：异步轮询 + 发送 + 确认
// ==========================================
@Component
public class MessageDispatcher {

    @Autowired
    private MessageOutboxRepository outboxRepo;
    @Autowired
    private RabbitTemplate rabbitTemplate;

    // 每 5 秒轮询一次待发送消息
    @Scheduled(fixedDelay = 5000)
    public void dispatch() {
        List<MessageOutbox> pendingMessages = outboxRepo
            .findByStatusAndRetryCountLessThan("PENDING", 5); // 最多重试 5 次

        for (MessageOutbox msg : pendingMessages) {
            try {
                // 发送到 RabbitMQ
                rabbitTemplate.convertAndSend(
                    msg.getExchange(),
                    msg.getRoutingKey(),
                    msg.getPayload(),
                    message -> {
                        // 设置消息 ID，用于消费端幂等判断
                        message.getMessageProperties()
                               .setMessageId(msg.getMessageId());
                        return message;
                    }
                );

                // RabbitTemplate 配合 Publisher Confirm 使用
                // 如果配置了 confirm-callback，ack 后才标记为 SENT
                msg.setStatus("SENT");
                msg.setUpdateTime(new Date());
                outboxRepo.save(msg);

            } catch (Exception e) {
                msg.setRetryCount(msg.getRetryCount() + 1);
                if (msg.getRetryCount() >= 5) {
                    msg.setStatus("FAILED"); // 超过重试次数，标记失败
                    // 触发告警，人工介入
                }
                outboxRepo.save(msg);
            }
        }
    }
}
```

---

### 5.3 对比 RocketMQ 的事务消息

RocketMQ 原生支持事务消息（Half Message），不需要本地消息表。

```
RocketMQ 事务消息流程：

Producer                    RocketMQ Broker
   │                              │
   │  ① 发送 Half Message          │
   │  (消息对消费者不可见)          │
   │──────────────────────────────►│
   │                              │
   │  ② 执行本地事务（扣库存等）    │
   │  ┌────────────────────┐      │
   │  │ DB Transaction     │      │
   │  └────────────────────┘      │
   │                              │
   │  ③ 根据本地事务结果：          │
   │     成功 → Commit             │
   │     失败 → Rollback           │
   │──────────────────────────────►│
   │                              │  Commit → 消息对消费者可见
   │                              │  Rollback → 消息删除
   │                              │
   │  ④ 如果 ③ 没有到达（网络断了）  │
   │                              │
   │  ⑤ Broker 主动回查              │
   │◄──────────────────────────────│  "你的本地事务成功了吗？"
   │                              │
   │  ⑥ 根据 DB 状态回复            │
   │──────────────────────────────►│
```

| 对比维度 | RabbitMQ (Outbox Pattern) | RocketMQ (原生事务消息) |
|---------|--------------------------|----------------------|
| 需要额外组件 | 本地消息表 + 定时任务 | 无需额外组件 |
| 实现复杂度 | 中等（需要维护消息表） | 低（SDK 原生支持） |
| 一致性保证 | 最终一致（轮询间隔存在延迟） | 最终一致（回查机制更快） |
| 适用场景 | 已有 RabbitMQ 基础设施 | 新项目、对一致性要求高 |

> **一句话总结：** RabbitMQ 没有原生事务消息支持，需要通过"本地消息表 + 定时投递 + Publisher Confirm"的 Outbox 模式实现最终一致性；如果事务消息是核心需求，RocketMQ 是更自然的选择。

---

## 六、延迟消息与定时消息

### 6.1 TTL + DLX 方案（原生方案）

**类比：食品保质期**

给消息设置一个"保质期"（TTL），过期后消息变成"过期食品"被扔进"垃圾回收站"（Dead Letter Exchange），而这个垃圾回收站其实连接着真正的处理队列。

```
正常流程：

Producer ──► [延迟队列：TTL=30s，配置了 DLX]
                      │
                   消息在这里"躺"30秒
                      │
                   30秒后，消息过期
                      │
                      ▼
              Dead Letter Exchange（死信交换机）
                      │
                      ▼
              [真正的处理队列] ──► Consumer
                                  （30秒后才收到消息）
```

```java
// 声明延迟队列（消息在这里等待过期）
Map<String, Object> args = new HashMap<>();
args.put("x-dead-letter-exchange", "dlx.exchange");       // 过期后转发到这个交换机
args.put("x-dead-letter-routing-key", "dlx.routing.key"); // 转发时使用这个 routing key
args.put("x-message-ttl", 30000);  // 队列级 TTL：所有消息 30 秒过期

channel.queueDeclare("delay.queue.30s", true, false, false, args);

// 声明死信交换机和真正的处理队列
channel.exchangeDeclare("dlx.exchange", "direct", true);
channel.queueDeclare("real.process.queue", true, false, false, null);
channel.queueBind("real.process.queue", "dlx.exchange", "dlx.routing.key");

// 也可以为单条消息设置不同的 TTL
AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
    .expiration("60000")  // 这条消息 60 秒后过期
    .build();
channel.basicPublish("", "delay.queue.30s", props, message.getBytes());
```

**致命陷阱：队列头部阻塞问题！**

```
这是一个很多人不知道的坑：

队列中的消息：
  ┌──────────────────────────────────────────────────┐
  │  head                                      tail  │
  │  [msg1: TTL=60s] [msg2: TTL=10s] [msg3: TTL=5s] │
  └──────────────────────────────────────────────────┘

  RabbitMQ 只检查队列头部的消息是否过期！

  时间线：
  t=0s:   msg1(60s), msg2(10s), msg3(5s) 入队
  t=5s:   msg3 本应过期，但 msg1 在队列头部，还没过期 → msg3 被堵住了！
  t=10s:  msg2 本应过期，但 msg1 还没过期 → msg2 也被堵住了！
  t=60s:  msg1 终于过期 → msg1, msg2, msg3 一起被投递到死信队列

  结果：msg2 延迟了 50 秒，msg3 延迟了 55 秒！

  ⚠️ 只有队列级 TTL（所有消息相同过期时间）不受此影响
     消息级 TTL（每条消息不同过期时间）必然遇到此问题
```

```
队列头部阻塞示意图：

时间轴 (秒)
0    5    10   15   20   ...  55   60
│    │    │    │    │         │    │
│    │    │    │    │         │    ├── msg1 过期 → 投递 DLX ✓
│    │    │    │    │         │    ├── msg2 也投递（但已经晚了 50 秒）
│    │    │    │    │         │    └── msg3 也投递（但已经晚了 55 秒）
│    │    │    │    │         │
│    │    ├── msg2 本该在这里过期（被 msg1 挡住）
│    ├── msg3 本该在这里过期（被 msg1 挡住）
├── msg1(60s), msg2(10s), msg3(5s) 入队
```

---

### 6.2 Delayed Message Plugin（推荐方案）

```bash
# 启用插件
rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

**工作原理：**

```
普通 Exchange：消息立刻路由到 Queue
Delayed Exchange：消息先存储在 Mnesia 中，到期后才路由到 Queue

Producer ──► [Delayed Exchange]
                    │
                 Mnesia 中保存，定时检查
                    │
              delay 时间到了
                    │
                    ▼
              正常路由到 Queue ──► Consumer
```

```java
// 声明延迟交换机
Map<String, Object> exchangeArgs = new HashMap<>();
exchangeArgs.put("x-delayed-type", "direct"); // 底层路由类型

channel.exchangeDeclare("delayed.exchange",
    "x-delayed-message",  // 交换机类型
    true,                 // durable
    false,                // autoDelete
    exchangeArgs);

channel.queueDeclare("delayed.queue", true, false, false, null);
channel.queueBind("delayed.queue", "delayed.exchange", "delayed.routing.key");

// 发送延迟消息
Map<String, Object> headers = new HashMap<>();
headers.put("x-delay", 30000); // 延迟 30 秒（毫秒为单位）

AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
    .headers(headers)
    .build();

channel.basicPublish("delayed.exchange", "delayed.routing.key",
    props, "delayed message".getBytes());
// 30 秒后 Consumer 才能收到这条消息
```

**局限性：**
- 延迟消息存储在 Mnesia 中（内存 + 磁盘），大量延迟消息会占用大量内存
- 不适合百万级延迟消息场景
- 延迟精度约为秒级
- 集群环境下，延迟消息只存在于接收它的那个节点上

---

### 6.3 对比其他延迟方案

| 方案 | 精度 | 容量 | 复杂度 | 适用场景 |
|------|------|------|--------|---------|
| TTL + DLX | 秒级（有头部阻塞问题） | 中 | 低 | 固定延迟时间的场景 |
| Delayed Message Plugin | 秒级 | 中（Mnesia 限制） | 低 | 灵活延迟，消息量不大 |
| Redis ZSET + 轮询 | 秒级 | 大 | 中 | 已有 Redis 基础设施 |
| 时间轮算法 (Kafka/Netty) | 毫秒级 | 大 | 高 | 高精度、大容量延迟场景 |
| 数据库轮询 | 秒~分钟级 | 很大 | 低 | 对精度要求不高的场景 |

> **一句话总结：** 固定延迟用 TTL + DLX，灵活延迟用 Delayed Message Plugin，大规模延迟考虑 Redis ZSET 或时间轮；TTL + DLX 的队列头部阻塞问题是面试高频陷阱题。

---

## 七、集群与高可用

### 7.1 RabbitMQ 集群架构

**类比：连锁便利店**

每家店（Node）都知道总部的商品目录（元数据），但每家店的库存（消息数据）默认只在自己店里。你去 A 店问 B 店的库存，A 店会帮你去 B 店查（代理转发）。

```
┌─────────────────────────────────────────────────────────────────┐
│                   RabbitMQ Cluster（Erlang 分布式）                │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │   Node 1    │   │   Node 2    │   │   Node 3    │          │
│  │  (rabbit@n1)│   │  (rabbit@n2)│   │  (rabbit@n3)│          │
│  │             │   │             │   │             │          │
│  │ [Mnesia]    │   │ [Mnesia]    │   │ [Mnesia]    │          │
│  │ Exchange定义│◄─►│ Exchange定义│◄─►│ Exchange定义│          │
│  │ Queue定义   │   │ Queue定义   │   │ Queue定义   │          │
│  │ Binding关系 │   │ Binding关系 │   │ Binding关系 │          │
│  │ 用户权限    │   │ 用户权限    │   │ 用户权限    │          │
│  │ (全部同步)  │   │ (全部同步)  │   │ (全部同步)  │          │
│  │             │   │             │   │             │          │
│  │ [Queue A]   │   │ [Queue B]   │   │ [Queue C]   │          │
│  │ 消息数据    │   │ 消息数据    │   │ 消息数据    │          │
│  │ (本节点独有) │   │ (本节点独有) │   │ (本节点独有) │          │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          │
│         │                 │                 │                  │
│         └─────── Erlang Distribution Protocol ───────┘         │
│                  (节点间通信)                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
      Client 1          Client 2          Client 3

如果 Client 1 连接 Node 1 但要消费 Queue B（在 Node 2）：
Node 1 会透明地从 Node 2 拉取消息转发给 Client 1
（增加了延迟，所以最好客户端直连 Queue 所在节点）
```

**关键点：**
- **元数据全节点同步**（Exchange、Queue 定义、Binding、用户权限）
- **消息数据默认只在 Queue 所属节点**（除非配置了镜像或 Quorum Queue）
- 如果 Queue 所属节点宕机，该 Queue 上的消息不可用（除非有副本）

---

### 7.2 经典镜像队列（Classic Mirrored Queue）

```
ha-mode 配置选项：

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ha-mode: all （所有节点都有副本）                              │
│  Node1: [Queue-master]  Node2: [Queue-mirror] Node3: [mirror]│
│  安全性最高，但同步开销最大                                     │
│                                                              │
│  ha-mode: exactly, ha-params: 2 （指定副本数量）               │
│  Node1: [Queue-master]  Node2: [Queue-mirror] Node3: [无]    │
│  推荐方式，兼顾安全和性能                                      │
│                                                              │
│  ha-mode: nodes, ha-params: [rabbit@n1, rabbit@n2]           │
│  指定具体在哪些节点上存副本                                     │
│  运维复杂，不推荐                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**镜像队列的问题：**
1. **同步阻塞：** 新加入的 Mirror 需要从 Master 同步全量消息，期间队列会阻塞
2. **脑裂风险：** 网络分区时可能出现两个 Master
3. **性能衰减：** 每条消息都要同步到所有 Mirror，Mirror 越多越慢
4. **已被标记弃用：** RabbitMQ 3.13 起标记为 deprecated，推荐迁移到 Quorum Queue

---

### 7.3 仲裁队列（Quorum Queue） -- 新一代方案

```
Quorum Queue 基于 Raft 共识协议：

                     ┌──────────────────┐
                     │    Leader Node   │  ← 所有写操作都经过 Leader
                     │    (Queue A)     │
                     └────────┬─────────┘
                              │
                  ┌───────────┼───────────┐
                  │           │           │
                  ▼           ▼           ▼
           ┌──────────┐ ┌──────────┐ ┌──────────┐
           │Follower 1│ │Follower 2│ │Follower 3│
           │ (副本)   │ │ (副本)   │ │ (副本)   │
           └──────────┘ └──────────┘ └──────────┘

写入流程（Raft Log Replication）：
  1. Producer 发送消息到 Leader
  2. Leader 将消息追加到本地 Raft Log
  3. Leader 将消息复制到 Followers
  4. 多数派（3/5 或 2/3）确认写入后
  5. Leader 向 Producer 发送 ack

Leader 选举（当 Leader 宕机时）：
  1. Follower 发现 Leader 心跳超时
  2. 发起新一轮选举
  3. 获得多数派投票的 Follower 成为新 Leader
  4. 全程自动，无需人工干预
```

**Quorum Queue 的优势：**

| 特性 | 说明 |
|------|------|
| 强一致性 | 基于 Raft，多数派写入才确认 |
| 自动 Leader 选举 | 节点宕机后秒级恢复 |
| 无同步阻塞 | 新节点自动通过 Raft Log 追赶 |
| Poison Message 处理 | 内建投递次数限制，超过阈值自动进入死信 |
| 高效磁盘存储 | 消息直接写 WAL，比 Classic Queue 更适合大量堆积 |

```java
// Spring Boot 配置 Quorum Queue
@Configuration
public class RabbitConfig {

    @Bean
    public Queue quorumQueue() {
        return QueueBuilder.durable("my.quorum.queue")
            .quorum()                    // 声明为 Quorum Queue
            .deliveryLimit(5)            // 投递超过 5 次进入死信（Poison Message 保护）
            .deadLetterExchange("dlx")
            .build();
    }
}
```

---

### 7.4 负载均衡与客户端连接

```
推荐的生产架构：

                    ┌──────────────┐
                    │   HAProxy /  │
                    │    Nginx     │  ← 四层负载均衡（TCP 代理）
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         ┌─────────┐ ┌─────────┐ ┌─────────┐
         │ Node 1  │ │ Node 2  │ │ Node 3  │
         └─────────┘ └─────────┘ └─────────┘

HAProxy 配置关键点：
  - 使用 TCP 模式（mode tcp），不是 HTTP 模式
  - 健康检查：通过 AMQP 协议握手或 HTTP API(/api/healthchecks/node)
  - 连接分配：round-robin 或 least-connection
```

```java
// Spring AMQP 的自动恢复机制
// application.yml 配置
// spring:
//   rabbitmq:
//     addresses: node1:5672,node2:5672,node3:5672  # 多节点地址
//     connection-timeout: 5000
//     template:
//       retry:
//         enabled: true       # 发送重试
//         initial-interval: 1000
//         max-attempts: 3
//     listener:
//       simple:
//         retry:
//           enabled: true     # 消费重试
//           initial-interval: 1000
//           max-attempts: 3
```

Spring AMQP 底层使用 `CachingConnectionFactory`，它内置了：
- **连接自动恢复：** TCP 断开后自动重连
- **通道自动恢复：** Channel 关闭后自动重建
- **消费者自动恢复：** 连接恢复后自动重新注册 Consumer

> **一句话总结：** Quorum Queue 是 RabbitMQ 高可用的未来方向，基于 Raft 协议提供强一致性和自动故障转移；生产环境用 HAProxy 做负载均衡，Spring AMQP 自带连接自动恢复。

---

## 八、性能优化

### 8.1 吞吐量优化

```
影响吞吐量的因素排序（从大到小）：

  持久化                ████████████████████  影响最大
  Prefetch Count       ████████████████
  消费者并发数          ██████████████
  Confirm 模式          ████████████
  消息大小              ██████████
  Exchange 类型         ████████
  网络延迟              ██████                影响最小（同机房内）
```

**关键优化手段：**

| 优化项 | 方法 | 效果 | 代价 |
|--------|------|------|------|
| 提高 Prefetch | 从默认 250 调到 500-1000 | 吞吐量提升 30%-50% | 消费者内存增加 |
| 多 Channel/Consumer | 开启多个消费者并行消费 | 近线性扩展 | CPU 和连接数增加 |
| 异步 Confirm | 替代同步 Confirm | 发送速度提升 5-10 倍 | 实现复杂度增加 |
| 非持久化消息 | deliveryMode=1 | 吞吐量提升 2-3 倍 | 消息可能丢失 |
| Lazy Queue | 适合消息堆积场景 | 避免内存溢出 | 读取延迟增加 |
| 批量发送 | 攒一批再发 | 减少网络往返 | 单条延迟增加 |

---

### 8.2 延迟优化

```
消息从发送到消费的延迟组成：

Producer → Network → Broker(Routing + Persist) → Network → Consumer

  网络延迟(发送)     0.1-1ms    （同机房）
  Exchange路由       0.01ms     （Direct）/ 0.1ms（Topic）
  持久化            0.5-5ms    （SSD）/ 5-50ms（HDD）
  队列投递           0.01ms
  网络延迟(消费)     0.1-1ms
  ──────────────────────────────
  总延迟             ~1-10ms    （同机房 SSD）
```

**降低延迟的方法：**

1. **使用 Direct Exchange：** 路由速度最快（O(1) 哈希查找）
2. **非持久化消息：** 跳过磁盘写入，延迟降低 80%（但消息可能丢）
3. **消费者并发调优：** `spring.rabbitmq.listener.simple.concurrency=5-20`
4. **同机房部署：** 网络延迟从毫秒级降到亚毫秒级
5. **关闭不必要的 Publisher Confirm：** 减少一个网络往返

---

### 8.3 关键监控指标

```
┌──────────────────────────────── RabbitMQ 监控仪表板 ──────────────────────────┐
│                                                                               │
│  队列健康                           │  连接与通道                              │
│  ├── messages_ready:      12,450    │  ├── connections:       45              │
│  │   (待消费消息数)                  │  │   (TCP 连接数)                       │
│  ├── messages_unacked:    350       │  ├── channels:          180            │
│  │   (已投递未确认)                  │  │   (虚拟通道数)                       │
│  └── consumers:           8         │  └── channel/connection: 4.0           │
│      (消费者数量)                    │      (每个连接的通道数)                   │
│                                     │                                         │
│  消息速率                            │  资源使用                               │
│  ├── publish_rate:    1,200 msg/s   │  ├── memory_used:       1.2 GB         │
│  │   (发送速率)                      │  │   memory_limit:      3.2 GB         │
│  ├── deliver_rate:    1,150 msg/s   │  │   (内存使用/限制)                     │
│  │   (消费速率)                      │  ├── disk_free:         45 GB          │
│  └── ack_rate:        1,100 msg/s   │  │   disk_limit:        2 GB           │
│      (确认速率)                      │  │   (磁盘剩余/限制)                    │
│                                     │  └── fd_used/fd_total:  234/65536      │
│  ⚠️ 告警规则：                        │      (文件描述符使用率)                  │
│  publish > deliver 持续 5min → 积压   │                                         │
│  unacked > prefetch*consumers → 阻塞 │  consumer_utilisation: 98%             │
│  memory_used > 80% limit → 即将限流  │  (消费者利用率，越高越好)                │
│                                     │                                         │
└─────────────────────────────────────┴─────────────────────────────────────────┘
```

**通过 Management API 查询监控数据：**

```bash
# 获取所有队列的概要信息
# 重点关注：messages（总消息数）、messages_ready（待消费）、messages_unacknowledged（未确认）
curl -u guest:guest http://localhost:15672/api/queues

# 获取指定队列的详细信息（包括消息速率）
curl -u guest:guest http://localhost:15672/api/queues/%2f/my_queue

# 获取节点信息（内存、磁盘、文件描述符）
curl -u guest:guest http://localhost:15672/api/nodes

# 获取全局概要（连接数、通道数、队列数、消息速率）
curl -u guest:guest http://localhost:15672/api/overview
```

**Java 代码：通过 Spring Boot Actuator 集成监控**

```java
// application.yml
// management:
//   endpoints:
//     web:
//       exposure:
//         include: health,metrics,prometheus
//   health:
//     rabbit:
//       enabled: true  # 开启 RabbitMQ 健康检查

// 自定义监控指标
@Component
public class RabbitMetricsCollector {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private MeterRegistry meterRegistry;

    @Scheduled(fixedRate = 10000) // 每 10 秒采集
    public void collectQueueMetrics() {
        // 通过 RabbitAdmin 获取队列信息
        RabbitAdmin admin = new RabbitAdmin(rabbitTemplate.getConnectionFactory());
        Properties queueProps = admin.getQueueProperties("my_queue");

        if (queueProps != null) {
            int messageCount = (int) queueProps.get("QUEUE_MESSAGE_COUNT");
            int consumerCount = (int) queueProps.get("QUEUE_CONSUMER_COUNT");

            // 记录到 Prometheus / Grafana
            meterRegistry.gauge("rabbitmq.queue.messages", messageCount);
            meterRegistry.gauge("rabbitmq.queue.consumers", consumerCount);
        }
    }
}
```

> **一句话总结：** 性能优化的核心是"发得快、存得住、消费得及时"；重点监控队列深度、消息速率差和消费者利用率，当 publish_rate 持续大于 deliver_rate 时就是积压的前兆。

---

## 附录：核心概念速查表

| 概念 | 一句话解释 |
|------|-----------|
| Exchange | 路由器，决定消息去哪个队列 |
| Binding | Exchange 和 Queue 之间的路由规则 |
| Channel | TCP 连接上的虚拟通道，轻量且不跨线程共享 |
| Publisher Confirm | 生产者确认机制，Broker 收到消息后回执 |
| Manual Ack | 消费者手动确认，处理完才通知 Broker 删除消息 |
| Prefetch | 限制一次推给消费者的消息数量，防止 OOM |
| Quorum Queue | 基于 Raft 的新一代高可用队列 |
| DLX | 死信交换机，处理过期/被拒绝/超长的消息 |
| TTL | 消息或队列的存活时间，过期后变成死信 |
| Flow Control | 流量控制，防止 Broker 被压垮 |
| Outbox Pattern | 本地消息表模式，保证数据库和 MQ 的最终一致性 |

---

> 全文完。每个知识点都遵循"类比引入 → 原理拆解 → 代码验证 → 陷阱警示"的结构，目标是让读者不仅知道 How，更理解 Why。
