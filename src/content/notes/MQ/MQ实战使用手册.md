# 消息队列（MQ）实战使用手册

> 以 RabbitMQ 为主线，面向 Java/Spring Boot 技术栈，覆盖从零接入到企业级落地的全流程。

---

## 一、MQ 解决什么问题？

MQ 不是银弹，但在以下三个场景中几乎不可替代。

### 1. 异步解耦

**场景：电商下单后需要触发多个下游操作**

没有 MQ 时，订单服务同步调用每一个下游：

```
用户下单请求
    │
    ▼
┌──────────┐
│  订单服务  │
└────┬─────┘
     │  ① 同步调用扣减库存（200ms）
     │  ② 同步调用增加积分（150ms）
     │  ③ 同步调用发送短信（300ms）
     │  ④ 同步调用创建物流单（250ms）
     ▼
总耗时 = 200+150+300+250 = 900ms
任何一个下游挂了，整个下单失败
```

**痛点一目了然：**
- 响应时间是所有下游耗时之和，用户等到崩溃
- 任一下游故障导致整个下单链路失败——积分系统挂了，用户连货都买不了
- 每新增一个下游（比如加个数据分析服务），订单服务就要改代码、重新发版

引入 MQ 后：

```
用户下单请求
    │
    ▼
┌──────────┐    发布"下单成功"事件     ┌────────────┐
│  订单服务  │ ──────────────────────▶ │  RabbitMQ   │
└──────────┘     仅需 5ms             └─────┬──────┘
  立即返回                                   │
  总耗时 ≈ 下单本身 + 5ms                    ├──▶ 库存服务（异步消费）
                                             ├──▶ 积分服务（异步消费）
                                             ├──▶ 短信服务（异步消费）
                                             └──▶ 物流服务（异步消费）
```

**改进效果：**
- 订单服务只关心"下单"本身，响应时间从 900ms 降到 50ms 量级
- 积分系统宕机不影响下单，消息在 MQ 中等待，积分服务恢复后继续消费
- 新增下游只需订阅同一个事件，订单服务零改动

---

### 2. 削峰填谷

**场景：秒杀活动，10 万 QPS 瞬间涌入，数据库只能承受 5000 QPS**

```
                  10万请求/s
                     │
                     ▼
              ┌─────────────┐
              │   接入层/网关  │
              └──────┬──────┘
                     │ 写入 MQ（MQ 承受 10万/s 毫无压力）
                     ▼
              ┌─────────────┐
              │  RabbitMQ    │  ← 消息暂存在队列中
              └──────┬──────┘
                     │ 消费者按固定速率拉取（5000/s）
                     ▼
              ┌─────────────┐
              │   数据库      │  ← 稳定在 5000 QPS，不会被打垮
              └─────────────┘
```

**核心逻辑：** MQ 把"瞬时高峰"变成"持续稳定流量"。高峰期消息在队列中堆积，低谷期消费者慢慢消化。数据库始终在安全水位运行。

> 代价是用户请求变成异步——秒杀场景中"排队中，请稍候"就是这个原理。

---

### 3. 数据分发（一对多广播）

**场景：用户注册成功后，需要同时触发多个操作**

```
                    ┌──────────┐
               ┌──▶│ 邮件服务   │  发送欢迎邮件
               │   └──────────┘
┌──────────┐   │   ┌──────────┐
│ 用户注册  │──▶│──▶│ 优惠券服务 │  发放新人券
│  事件     │   │   └──────────┘
└──────────┘   │   ┌──────────┐
  (fanout      └──▶│ 用户画像  │  初始化用户档案
   exchange)       └──────────┘
```

RabbitMQ 的 **Fanout Exchange** 天然支持这种一对多广播：消息发到 Exchange，所有绑定的队列都会收到副本。新增下游只需创建新队列并绑定，生产者无感知。

---

### 决策表：什么时候该用 MQ，什么时候不该用

| 场景 | 是否使用 MQ | 原因 |
|------|:-----------:|------|
| 下游操作可异步，不影响主流程结果 | 用 | 典型解耦场景 |
| 上游瞬时流量远超下游处理能力 | 用 | 削峰填谷 |
| 一个事件需要通知多个不相关的下游 | 用 | 数据分发 |
| 需要严格的请求-响应语义（如查询余额）| 不用 | MQ 是异步的，不适合同步查询 |
| 两个服务之间是简单的一对一调用且延迟敏感 | 不用 | 直接 RPC/HTTP 更简单，加 MQ 反而增加复杂度 |
| 数据量极小、系统极简单（日活几百人）| 不用 | 杀鸡用牛刀，运维成本大于收益 |
| 需要强一致性的同步事务 | 慎用 | MQ 天然是最终一致性，需配合额外方案 |

---

## 二、主流 MQ 选型对比

### 核心对比表

| 维度 | RabbitMQ | RocketMQ | Kafka |
|------|----------|----------|-------|
| **开发语言** | Erlang | Java | Scala + Java |
| **协议** | AMQP 0-9-1（标准协议） | 自定义协议 | 自定义协议 |
| **单机吞吐** | 万级（1~5 万/s） | 十万级（10~20 万/s） | 百万级（百万/s） |
| **消息延迟** | 微秒级（最低） | 毫秒级 | 毫秒级（批量发送有延迟） |
| **消息可靠性** | 极高（confirm + 持久化 + 手动 ack） | 极高（同步刷盘 + 主从同步） | 高（ISR + acks=all） |
| **延迟消息** | 需插件或 TTL+DLX 变通 | 原生支持（18 个级别） | 不支持（需外部方案） |
| **事务消息** | 支持（AMQP 事务，性能差） | 原生支持（半消息机制，生产推荐） | 不支持 |
| **消息回溯** | 不支持（消费即删） | 支持（按时间戳回溯） | 支持（offset 回溯） |
| **消费模型** | Push（Broker 推给消费者） | Pull + 长轮询 | Pull（消费者主动拉取） |
| **管理界面** | 自带 Management UI，功能完善 | 有 Dashboard，一般 | 无官方 UI，依赖第三方 |
| **Spring 生态** | spring-boot-starter-amqp（官方一等支持）| rocketmq-spring-boot-starter | spring-kafka（官方支持） |
| **社区/文档** | 国际社区活跃，文档极好 | 阿里开源，中文资料丰富 | Apache 顶级项目，社区庞大 |
| **典型场景** | 业务消息、实时通知、任务调度 | 电商交易、金融、顺序消息 | 日志采集、大数据流、事件溯源 |
| **运维复杂度** | 中（Erlang 排查问题门槛高） | 中（Java 栈，排查相对友好） | 高（依赖 ZooKeeper/KRaft，集群管理复杂） |

### 选型建议

**选 RabbitMQ 的理由：**
- 业务系统消息传递（订单、通知、任务）——延迟低、可靠性高、路由灵活
- 团队规模中等，需要开箱即用的管理界面和监控
- Spring Boot 项目——`spring-boot-starter-amqp` 是 Spring 官方维护的一等公民
- 需要复杂路由逻辑（Direct/Topic/Fanout/Headers 四种 Exchange 类型）

**选 RocketMQ 的理由：**
- 需要原生事务消息（半消息）——金融、电商强一致性场景
- 需要原生延迟消息——不想依赖插件
- 团队以 Java 为主，希望出问题时能直接翻源码

**选 Kafka 的理由：**
- 日志采集、埋点数据、大数据管道——吞吐量碾压级优势
- 需要消息回溯能力（重放历史消息）
- 下游对接 Flink/Spark/HDFS 等大数据组件

> **本手册以 RabbitMQ 为主线。** 原因：在 Java 企业级业务系统中，RabbitMQ 是综合性价比最高的选择——延迟最低、功能最全、Spring 集成最成熟、文档最友好。

---

## 三、RabbitMQ 核心概念速览

### 快递物流类比

| RabbitMQ 概念 | 快递类比 | 说明 |
|---------------|---------|------|
| **Producer** | 寄件人 | 发送消息的应用程序 |
| **Exchange** | 分拣中心 | 接收消息，按规则路由到对应队列。自己不存储消息 |
| **Binding** | 分拣规则 | Exchange 和 Queue 之间的绑定关系，定义路由规则 |
| **Queue** | 快递柜 | 实际存储消息的地方，消费者从这里取消息 |
| **Consumer** | 收件人 | 接收并处理消息的应用程序 |
| **Virtual Host** | 不同快递公司的独立仓库 | 逻辑隔离，不同 vhost 之间的 Exchange/Queue 互不可见 |
| **Routing Key** | 快递单上的收件地址 | 生产者发消息时指定，Exchange 根据它决定路由 |

**消息完整流转路径：**

```
Producer ──(routing key)──▶ Exchange ──(binding rule)──▶ Queue ──▶ Consumer
 寄件人       收件地址         分拣中心       分拣规则       快递柜     收件人
```

---

### 四种 Exchange 类型

#### 1. Direct Exchange（直连交换机）

Routing Key **精确匹配**，消息只会路由到 Binding Key 完全相同的队列。

```
Producer
  │
  │ routing_key = "order.pay"
  ▼
┌─────────────────────┐
│   Direct Exchange    │
└──┬─────────┬────────┘
   │         │
   │ binding │ binding
   │ key=    │ key=
   │"order.  │"order.
   │ pay"    │ create"
   ▼         ▼
┌───────┐ ┌────────┐
│Queue A│ │Queue B │   ← Queue B 收不到，因为 key 不匹配
└───────┘ └────────┘
  收到!      ✗
```

**适用场景：** 点对点精确路由，如不同类型的订单事件发到不同队列。

#### 2. Fanout Exchange（扇出交换机）

**忽略 Routing Key，广播到所有绑定队列。**

```
Producer
  │
  │ routing_key = "ignored"（写什么都不影响）
  ▼
┌─────────────────────┐
│   Fanout Exchange    │
└──┬──────┬──────┬────┘
   │      │      │
   ▼      ▼      ▼
┌─────┐┌─────┐┌─────┐
│Q-邮件││Q-券 ││Q-画像│  ← 全部收到
└─────┘└─────┘└─────┘
```

**适用场景：** 一对多广播，如用户注册事件通知多个下游。

#### 3. Topic Exchange（主题交换机）

Routing Key 支持**通配符匹配**：
- `*` 匹配一个单词
- `#` 匹配零个或多个单词

```
Producer 发送 routing_key = "order.pay.success"

┌───────────────────────┐
│    Topic Exchange      │
└──┬──────────┬─────────┘
   │          │
   │ binding  │ binding
   │ key=     │ key=
   │"order.#" │"order.pay.*"
   ▼          ▼
┌────────┐ ┌────────┐
│Queue A │ │Queue B │     ← 两个都能收到
└────────┘ └────────┘

Producer 发送 routing_key = "order.create"

  Queue A 收到（order.# 匹配 order 开头的任意层级）
  Queue B 收不到（order.pay.* 要求三段且第二段是 pay）
```

**适用场景：** 需要灵活路由规则的场景，是实际项目中使用频率最高的 Exchange 类型。

#### 4. Headers Exchange（头部交换机）

根据消息的 Header 属性匹配，而非 Routing Key。支持 `x-match=all`（全部匹配）和 `x-match=any`（任一匹配）。

> 实际项目中极少使用，Topic Exchange 几乎可以覆盖所有路由需求。知道有这个类型即可。

---

## 四、从零到跑通：RabbitMQ 完整接入流程

### 4.1 环境搭建（Docker Compose）

生产环境推荐用 Docker 部署，方便版本管理和迁移。

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  rabbitmq:
    # 带 management 后缀的镜像包含 Web 管理界面
    image: rabbitmq:3.13-management
    container_name: rabbitmq
    hostname: rabbitmq-node1
    ports:
      # 5672: AMQP 协议端口，应用程序连接用
      - "5672:5672"
      # 15672: Management UI 端口，浏览器访问用
      - "15672:15672"
    environment:
      # 默认用户名密码，生产环境务必修改
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123
      # 默认 Virtual Host
      RABBITMQ_DEFAULT_VHOST: /
    volumes:
      # 数据持久化，防止容器重启丢失消息
      - rabbitmq_data:/var/lib/rabbitmq
    restart: unless-stopped

volumes:
  rabbitmq_data:
    driver: local
```

启动并验证：

```bash
# 启动
docker-compose up -d

# 查看日志，确认启动成功
docker logs -f rabbitmq

# 浏览器访问管理界面
# http://localhost:15672
# 用户名: admin  密码: admin123
```

管理界面能看到 Connections、Channels、Exchanges、Queues 等页面，说明启动成功。

---

### 4.2 Spring Boot 集成（企业主流方式）

#### Step 1：Maven 依赖

```xml
<dependencies>
    <!-- Spring AMQP：Spring Boot 对 RabbitMQ 的官方封装 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-amqp</artifactId>
    </dependency>

    <!-- Web 启动器（提供 REST 接口用于演示触发消息发送） -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- JSON 序列化（消息体用 JSON 格式传输，跨语言友好） -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
</dependencies>
```

#### Step 2：application.yml 配置

```yaml
spring:
  rabbitmq:
    # Broker 连接地址
    host: localhost
    port: 5672
    # 虚拟主机，用于逻辑隔离，不同业务可用不同 vhost
    virtual-host: /
    username: admin
    password: admin123

    # ========== 生产者确认机制（防止消息丢失的关键） ==========
    # correlated：异步确认模式，消息到达 Exchange 后回调通知生产者
    # 可选值：none（不确认）、simple（同步等待）、correlated（异步回调，推荐）
    publisher-confirm-type: correlated
    # 开启 return 回调：消息到达 Exchange 但无法路由到任何 Queue 时触发
    publisher-returns: true
    template:
      # 当消息不可路由时，将消息返回给生产者而非静默丢弃
      mandatory: true

    # ========== 消费者配置 ==========
    listener:
      simple:
        # manual：手动确认模式，消费者处理完成后显式调用 ack
        # 如果用 auto（默认），消息取出就算确认——处理失败消息就丢了
        acknowledge-mode: manual
        # 每次从 Broker 预取 1 条消息，处理完再取下一条
        # 防止消费者内存被大量未处理消息撑爆
        prefetch: 1
        # 消费者重试配置
        retry:
          # 开启重试
          enabled: true
          # 首次重试间隔
          initial-interval: 1000ms
          # 重试间隔倍数（指数退避）
          multiplier: 2.0
          # 最大重试次数
          max-attempts: 3
          # 最大重试间隔
          max-interval: 10000ms

    # ========== 连接配置 ==========
    connection-timeout: 15000ms
    # Channel 缓存大小，根据并发消费者数量调整
    cache:
      channel:
        size: 25
```

#### Step 3：RabbitMQ 配置类

```java
package com.example.order.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // ==================== 常量定义 ====================
    // 集中管理 Exchange/Queue/RoutingKey 名称，避免硬编码散落各处

    // Direct Exchange：精确路由，用于订单支付事件
    public static final String ORDER_DIRECT_EXCHANGE = "order.direct.exchange";
    public static final String ORDER_PAY_QUEUE = "order.pay.queue";
    public static final String ORDER_PAY_ROUTING_KEY = "order.pay";

    // Fanout Exchange：广播，用于用户注册事件通知多个下游
    public static final String USER_FANOUT_EXCHANGE = "user.fanout.exchange";
    public static final String USER_EMAIL_QUEUE = "user.email.queue";
    public static final String USER_COUPON_QUEUE = "user.coupon.queue";

    // Topic Exchange：通配符路由，用于订单全生命周期事件
    public static final String ORDER_TOPIC_EXCHANGE = "order.topic.exchange";
    public static final String ORDER_ALL_QUEUE = "order.all.queue";           // 接收所有订单事件
    public static final String ORDER_PAY_NOTIFY_QUEUE = "order.pay.notify.queue"; // 只接收支付相关事件

    // ==================== 消息转换器 ====================

    /**
     * 使用 Jackson JSON 序列化消息体
     * 默认是 JDK 序列化——可读性差、跨语言不兼容、体积大，生产环境必须替换
     */
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /**
     * 配置 RabbitTemplate，注入 JSON 转换器和消息确认回调
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         MessageConverter jsonMessageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter);

        // Publisher Confirm 回调：消息是否成功到达 Exchange
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (ack) {
                // 消息成功到达 Exchange，正常情况，可记录日志
            } else {
                // 消息未到达 Exchange，需要告警 + 重发或落库补偿
                System.err.println("消息未到达Exchange, cause=" + cause
                    + ", correlationData=" + correlationData);
            }
        });

        // Return 回调：消息到达 Exchange 但无法路由到任何 Queue
        // 常见原因：Routing Key 写错、Queue 未绑定
        template.setReturnsCallback(returned -> {
            System.err.println("消息无法路由! " +
                "exchange=" + returned.getExchange() +
                ", routingKey=" + returned.getRoutingKey() +
                ", replyCode=" + returned.getReplyCode() +
                ", replyText=" + returned.getReplyText());
        });

        return template;
    }

    // ==================== Direct Exchange 配置 ====================

    @Bean
    public DirectExchange orderDirectExchange() {
        // durable=true：Broker 重启后 Exchange 依然存在
        // autoDelete=false：没有队列绑定时不自动删除
        return ExchangeBuilder.directExchange(ORDER_DIRECT_EXCHANGE)
                .durable(true)
                .build();
    }

    @Bean
    public Queue orderPayQueue() {
        // durable=true：队列持久化，Broker 重启后队列及其中的持久化消息不丢失
        return QueueBuilder.durable(ORDER_PAY_QUEUE).build();
    }

    @Bean
    public Binding orderPayBinding() {
        return BindingBuilder.bind(orderPayQueue())
                .to(orderDirectExchange())
                .with(ORDER_PAY_ROUTING_KEY);
    }

    // ==================== Fanout Exchange 配置 ====================

    @Bean
    public FanoutExchange userFanoutExchange() {
        return ExchangeBuilder.fanoutExchange(USER_FANOUT_EXCHANGE)
                .durable(true)
                .build();
    }

    @Bean
    public Queue userEmailQueue() {
        return QueueBuilder.durable(USER_EMAIL_QUEUE).build();
    }

    @Bean
    public Queue userCouponQueue() {
        return QueueBuilder.durable(USER_COUPON_QUEUE).build();
    }

    @Bean
    public Binding userEmailBinding() {
        // Fanout 不需要 Routing Key，绑定就会收到所有消息
        return BindingBuilder.bind(userEmailQueue())
                .to(userFanoutExchange());
    }

    @Bean
    public Binding userCouponBinding() {
        return BindingBuilder.bind(userCouponQueue())
                .to(userFanoutExchange());
    }

    // ==================== Topic Exchange 配置 ====================

    @Bean
    public TopicExchange orderTopicExchange() {
        return ExchangeBuilder.topicExchange(ORDER_TOPIC_EXCHANGE)
                .durable(true)
                .build();
    }

    @Bean
    public Queue orderAllQueue() {
        return QueueBuilder.durable(ORDER_ALL_QUEUE).build();
    }

    @Bean
    public Queue orderPayNotifyQueue() {
        return QueueBuilder.durable(ORDER_PAY_NOTIFY_QUEUE).build();
    }

    @Bean
    public Binding orderAllBinding() {
        // "order.#" 匹配所有 order 开头的 routing key
        // 如 order.create、order.pay.success、order.cancel 全部匹配
        return BindingBuilder.bind(orderAllQueue())
                .to(orderTopicExchange())
                .with("order.#");
    }

    @Bean
    public Binding orderPayNotifyBinding() {
        // "order.pay.*" 只匹配 order.pay 下一级，如 order.pay.success、order.pay.fail
        // 不匹配 order.create
        return BindingBuilder.bind(orderPayNotifyQueue())
                .to(orderTopicExchange())
                .with("order.pay.*");
    }
}
```

#### Step 4：消息生产者

```java
package com.example.order.producer;

import com.example.order.config.RabbitMQConfig;
import com.example.order.dto.OrderEvent;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class OrderEventProducer {

    private final RabbitTemplate rabbitTemplate;

    // 构造器注入，Spring 推荐方式，便于测试
    public OrderEventProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    /**
     * 发送订单支付事件（Direct Exchange，精确路由）
     */
    public void sendOrderPayEvent(OrderEvent event) {
        // CorrelationData 用于 Confirm 回调时关联原始消息
        // 实际项目中通常放业务 ID（如订单号），方便回调时定位是哪条消息
        CorrelationData correlationData = new CorrelationData(event.getOrderId());

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.ORDER_DIRECT_EXCHANGE,   // 目标 Exchange
                RabbitMQConfig.ORDER_PAY_ROUTING_KEY,    // Routing Key
                event,                                    // 消息体（自动 JSON 序列化）
                correlationData                           // 关联数据
        );
    }

    /**
     * 广播用户注册事件（Fanout Exchange，所有绑定队列都会收到）
     */
    public void broadcastUserRegisterEvent(Object userEvent) {
        // Fanout Exchange 忽略 routing key，但 API 要求传一个值，传空字符串即可
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.USER_FANOUT_EXCHANGE,
                "",
                userEvent
        );
    }

    /**
     * 发送订单生命周期事件（Topic Exchange，按事件类型灵活路由）
     *
     * @param routingKey 例如 "order.create"、"order.pay.success"、"order.cancel"
     * @param event      事件对象
     */
    public void sendOrderLifecycleEvent(String routingKey, OrderEvent event) {
        CorrelationData correlationData = new CorrelationData(
                UUID.randomUUID().toString()
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.ORDER_TOPIC_EXCHANGE,
                routingKey,
                event,
                correlationData
        );
    }
}
```

消息体 DTO：

```java
package com.example.order.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public class OrderEvent implements Serializable {

    private String orderId;          // 订单号
    private String userId;           // 用户 ID
    private BigDecimal amount;       // 订单金额
    private String eventType;        // 事件类型：CREATE / PAY / CANCEL
    private LocalDateTime eventTime; // 事件发生时间

    // 无参构造器（JSON 反序列化需要）
    public OrderEvent() {}

    public OrderEvent(String orderId, String userId, BigDecimal amount, String eventType) {
        this.orderId = orderId;
        this.userId = userId;
        this.amount = amount;
        this.eventType = eventType;
        this.eventTime = LocalDateTime.now();
    }

    // getter / setter 省略，实际项目建议用 Lombok @Data
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public LocalDateTime getEventTime() { return eventTime; }
    public void setEventTime(LocalDateTime eventTime) { this.eventTime = eventTime; }
}
```

#### Step 5：消息消费者

```java
package com.example.order.consumer;

import com.example.order.config.RabbitMQConfig;
import com.example.order.dto.OrderEvent;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class OrderEventConsumer {

    /**
     * 监听订单支付队列（手动 ACK 模式）
     *
     * 手动 ACK 的意义：只有业务逻辑真正处理成功后才确认消息，
     * 如果处理过程中抛异常或服务宕机，消息会重新入队被再次消费。
     */
    @RabbitListener(queues = RabbitMQConfig.ORDER_PAY_QUEUE)
    public void handleOrderPayEvent(@Payload OrderEvent event,
                                     Channel channel,
                                     @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag)
            throws IOException {
        try {
            // ===== 业务逻辑开始 =====
            System.out.println("收到订单支付事件: orderId=" + event.getOrderId()
                    + ", amount=" + event.getAmount());

            // 实际业务：扣减库存、记录流水等
            processPayment(event);

            // ===== 业务逻辑结束 =====

            // 处理成功，手动确认（basicAck）
            // 第二个参数 multiple=false 表示只确认当前这一条消息
            channel.basicAck(deliveryTag, false);

        } catch (Exception e) {
            System.err.println("处理订单支付事件失败: " + e.getMessage());

            // 处理失败，拒绝消息（basicNack）
            // 第三个参数 requeue：
            //   true  = 消息重新放回队列（适合临时性错误，如数据库暂时不可用）
            //   false = 消息不重新入队，直接丢弃或进入死信队列（适合不可恢复的错误）
            channel.basicNack(deliveryTag, false, false);
        }
    }

    /**
     * 监听订单全生命周期队列（Topic Exchange, routing key = order.#）
     */
    @RabbitListener(queues = RabbitMQConfig.ORDER_ALL_QUEUE)
    public void handleAllOrderEvents(@Payload OrderEvent event,
                                      Channel channel,
                                      @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag)
            throws IOException {
        try {
            System.out.println("【全量订单监听】事件类型=" + event.getEventType()
                    + ", orderId=" + event.getOrderId());
            // 全量事件可用于数据统计、日志审计等
            channel.basicAck(deliveryTag, false);
        } catch (Exception e) {
            channel.basicNack(deliveryTag, false, false);
        }
    }

    private void processPayment(OrderEvent event) {
        // 实际的支付处理逻辑
        // 如：调用库存服务扣减库存、更新订单状态等
    }
}
```

#### Step 6：完整调用示例（Controller 触发）

```java
package com.example.order.controller;

import com.example.order.dto.OrderEvent;
import com.example.order.producer.OrderEventProducer;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderEventProducer producer;

    public OrderController(OrderEventProducer producer) {
        this.producer = producer;
    }

    /**
     * 模拟创建订单并发送事件
     */
    @PostMapping("/create")
    public String createOrder(@RequestParam String userId,
                              @RequestParam BigDecimal amount) {
        String orderId = UUID.randomUUID().toString().replace("-", "");

        // 1. 写入订单数据库（此处省略）

        // 2. 发布订单创建事件（Topic Exchange）
        OrderEvent event = new OrderEvent(orderId, userId, amount, "CREATE");
        producer.sendOrderLifecycleEvent("order.create", event);

        return "订单创建成功: " + orderId;
    }

    /**
     * 模拟订单支付成功
     */
    @PostMapping("/{orderId}/pay")
    public String payOrder(@PathVariable String orderId) {
        // 1. 更新订单状态为已支付（此处省略）

        // 2. 发布支付成功事件（Direct Exchange，精确路由到库存服务）
        OrderEvent event = new OrderEvent(orderId, "user-001", new BigDecimal("99.00"), "PAY");
        producer.sendOrderPayEvent(event);

        // 3. 同时通过 Topic Exchange 发布，让所有订阅 order.pay.* 的消费者收到
        producer.sendOrderLifecycleEvent("order.pay.success", event);

        return "支付成功: " + orderId;
    }
}
```

---

### 4.3 消息确认机制配置（防丢失的关键）

消息从生产者到消费者经历三个阶段，每个阶段都可能丢消息：

```
Producer ──①──▶ Exchange/Broker ──②──▶ Queue(磁盘) ──③──▶ Consumer

① Producer → Broker：网络断了、Exchange 不存在 → 消息丢失
② Broker 内部：Broker 宕机，消息只在内存中 → 消息丢失
③ Broker → Consumer：Consumer 收到后还没处理就宕机 → 消息丢失
```

**三重保障方案：**

#### 阶段一：Publisher Confirm（生产者确认）

确保消息成功到达 Broker。上面 `RabbitMQConfig` 中已配置，核心代码回顾：

```java
// application.yml 中开启
// spring.rabbitmq.publisher-confirm-type: correlated
// spring.rabbitmq.publisher-returns: true

// RabbitTemplate 中设置回调
template.setConfirmCallback((correlationData, ack, cause) -> {
    if (!ack) {
        // 消息未到达 Exchange
        // 实际项目：记录到数据库 + 定时任务重发
        log.error("消息投递失败，correlationId={}, cause={}",
            correlationData != null ? correlationData.getId() : "null", cause);
    }
});

template.setReturnsCallback(returned -> {
    // 消息到达 Exchange 但无法路由到 Queue
    // 实际项目：记录日志告警，检查 Binding 配置
    log.error("消息路由失败，exchange={}, routingKey={}, replyText={}",
        returned.getExchange(), returned.getRoutingKey(), returned.getReplyText());
});
```

#### 阶段二：Broker 持久化

确保 Broker 重启后消息不丢。需要同时满足三个条件：

```java
// 1. Exchange 持久化（durable = true）
ExchangeBuilder.directExchange("order.exchange").durable(true).build();

// 2. Queue 持久化（durable = true）
QueueBuilder.durable("order.queue").build();

// 3. 消息持久化（deliveryMode = 2）
// Spring AMQP 默认就是持久化消息，无需额外设置
// 如果需要显式指定：
rabbitTemplate.convertAndSend(exchange, routingKey, message, msg -> {
    msg.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
    return msg;
});
```

> 三者缺一不可。Exchange 持久化但 Queue 不持久化——重启后队列消失，消息照样丢。

#### 阶段三：Consumer 手动 ACK

确保消费者真正处理完成后才确认消息：

```java
// application.yml
// spring.rabbitmq.listener.simple.acknowledge-mode: manual

@RabbitListener(queues = "order.queue")
public void handle(OrderEvent event, Channel channel,
                   @Header(AmqpHeaders.DELIVERY_TAG) long tag) throws IOException {
    try {
        // 业务处理
        doBusinessLogic(event);
        // 成功才 ACK
        channel.basicAck(tag, false);
    } catch (Exception e) {
        // 失败 NACK，requeue=false 让消息进死信队列人工处理
        channel.basicNack(tag, false, false);
    }
}
```

> 永远不要在生产环境用 `auto` ack 模式。消息从 Broker 取出的那一刻就确认了——如果处理过程中服务宕机，消息直接丢失且不可恢复。

---

## 五、企业级最佳实践

### 5.1 消息幂等性设计

**为什么需要幂等：** 网络抖动、消费者重启、手动 NACK 重试都会导致同一条消息被重复投递。如果消费逻辑不幂等，就会出现重复扣款、重复发券等事故。

#### 方案一：唯一 messageId + Redis 去重

```java
package com.example.order.consumer;

import com.example.order.config.RabbitMQConfig;
import com.example.order.dto.OrderEvent;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Component
public class IdempotentConsumer {

    private final StringRedisTemplate redisTemplate;

    // Redis key 前缀，按业务区分
    private static final String IDEMPOTENT_KEY_PREFIX = "mq:idempotent:order:";
    // 去重 key 的过期时间，超过这个时间允许重复消费（防止 Redis key 无限增长）
    private static final long EXPIRE_HOURS = 24;

    public IdempotentConsumer(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @RabbitListener(queues = RabbitMQConfig.ORDER_PAY_QUEUE)
    public void handleWithIdempotent(@Payload OrderEvent event,
                                      Channel channel,
                                      @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag,
                                      @Header(AmqpHeaders.MESSAGE_ID) String messageId)
            throws IOException {
        String idempotentKey = IDEMPOTENT_KEY_PREFIX + messageId;

        try {
            // 核心：用 Redis SETNX 实现幂等判断
            // setIfAbsent = SETNX，只有 key 不存在时才设置成功
            // 返回 true = 首次消费；返回 false = 重复消费
            Boolean isFirstTime = redisTemplate.opsForValue()
                    .setIfAbsent(idempotentKey, "1", EXPIRE_HOURS, TimeUnit.HOURS);

            if (Boolean.FALSE.equals(isFirstTime)) {
                // 重复消息，直接 ACK 丢弃，不执行业务逻辑
                System.out.println("重复消息，已忽略: messageId=" + messageId);
                channel.basicAck(deliveryTag, false);
                return;
            }

            // 首次消费，执行业务逻辑
            processPayment(event);

            channel.basicAck(deliveryTag, false);

        } catch (Exception e) {
            // 业务处理失败，删除 Redis 幂等 key，允许下次重试时重新消费
            redisTemplate.delete(idempotentKey);
            channel.basicNack(deliveryTag, false, false);
        }
    }

    private void processPayment(OrderEvent event) {
        // 实际支付处理逻辑
    }
}
```

#### 方案二：数据库唯一约束

适合不想引入 Redis 的简单场景。在业务表或消息消费记录表中对 messageId 加唯一索引：

```sql
CREATE TABLE mq_consume_record (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id  VARCHAR(64) NOT NULL,
    queue_name  VARCHAR(128) NOT NULL,
    status      TINYINT DEFAULT 0 COMMENT '0-处理中 1-成功 2-失败',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_message_id (message_id)
) ENGINE=InnoDB;
```

消费时先 INSERT，利用唯一约束天然防重：

```java
try {
    // INSERT 成功说明首次消费
    consumeRecordMapper.insert(messageId, queueName);
    // 执行业务逻辑
    processPayment(event);
    // 更新状态为成功
    consumeRecordMapper.updateStatus(messageId, 1);
    channel.basicAck(deliveryTag, false);
} catch (DuplicateKeyException e) {
    // 唯一约束冲突 = 重复消费，直接 ACK
    channel.basicAck(deliveryTag, false);
} catch (Exception e) {
    consumeRecordMapper.updateStatus(messageId, 2);
    channel.basicNack(deliveryTag, false, false);
}
```

> **选择建议：** 高并发场景用 Redis 方案（性能好），低并发或不想引入 Redis 用数据库方案（架构简单）。

---

### 5.2 死信队列（DLX）配置与使用

**什么是死信：** 消息在以下三种情况下变成"死信"：
1. 消费者调用 `basicNack` 或 `basicReject` 且 `requeue=false`
2. 消息 TTL 过期（队列级别或消息级别）
3. 队列达到最大长度 `x-max-length`

死信不会凭空消失——如果队列配置了死信交换机（DLX），死信会被自动转发到 DLX 绑定的队列中。

#### 实战场景：订单超时自动取消

```
用户下单 → 发送到"待支付队列"（TTL=30分钟）
    ↓ 30分钟内支付：正常消费，流程结束
    ↓ 30分钟未支付：消息过期 → 进入死信队列 → 触发取消订单逻辑
```

完整配置：

```java
package com.example.order.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DeadLetterConfig {

    // ===== 死信交换机和队列（处理超时订单的终点）=====
    public static final String ORDER_DLX_EXCHANGE = "order.dlx.exchange";
    public static final String ORDER_DLX_QUEUE = "order.dlx.queue";
    public static final String ORDER_DLX_ROUTING_KEY = "order.dlx";

    // ===== 业务队列（带 TTL，消息过期后自动转入死信）=====
    public static final String ORDER_DELAY_QUEUE = "order.delay.queue";
    public static final String ORDER_DELAY_EXCHANGE = "order.delay.exchange";
    public static final String ORDER_DELAY_ROUTING_KEY = "order.delay";

    // ---------- 死信侧配置 ----------

    @Bean
    public DirectExchange orderDlxExchange() {
        return ExchangeBuilder.directExchange(ORDER_DLX_EXCHANGE)
                .durable(true).build();
    }

    @Bean
    public Queue orderDlxQueue() {
        return QueueBuilder.durable(ORDER_DLX_QUEUE).build();
    }

    @Bean
    public Binding orderDlxBinding() {
        return BindingBuilder.bind(orderDlxQueue())
                .to(orderDlxExchange())
                .with(ORDER_DLX_ROUTING_KEY);
    }

    // ---------- 业务侧配置（带 TTL + DLX 指向）----------

    @Bean
    public DirectExchange orderDelayExchange() {
        return ExchangeBuilder.directExchange(ORDER_DELAY_EXCHANGE)
                .durable(true).build();
    }

    @Bean
    public Queue orderDelayQueue() {
        return QueueBuilder.durable(ORDER_DELAY_QUEUE)
                // 队列级别 TTL：所有进入此队列的消息 30 分钟后过期
                .ttl(30 * 60 * 1000)
                // 关键：指定死信交换机，过期消息自动转发到这里
                .deadLetterExchange(ORDER_DLX_EXCHANGE)
                // 指定死信路由键
                .deadLetterRoutingKey(ORDER_DLX_ROUTING_KEY)
                .build();
    }

    @Bean
    public Binding orderDelayBinding() {
        return BindingBuilder.bind(orderDelayQueue())
                .to(orderDelayExchange())
                .with(ORDER_DELAY_ROUTING_KEY);
    }
}
```

生产者发送待支付消息：

```java
/**
 * 下单后发送延迟消息，30分钟后如果还没支付就自动取消
 */
public void sendOrderTimeoutCheck(OrderEvent event) {
    // 消息发到带 TTL 的延迟队列
    // 注意：这里不需要设置消息级别的 TTL，因为队列级别已经设了 30 分钟
    rabbitTemplate.convertAndSend(
            DeadLetterConfig.ORDER_DELAY_EXCHANGE,
            DeadLetterConfig.ORDER_DELAY_ROUTING_KEY,
            event,
            new CorrelationData(event.getOrderId())
    );
}
```

消费者监听死信队列，处理超时取消：

```java
package com.example.order.consumer;

import com.example.order.config.DeadLetterConfig;
import com.example.order.dto.OrderEvent;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class OrderTimeoutConsumer {

    /**
     * 监听死信队列：处理超时未支付的订单
     */
    @RabbitListener(queues = DeadLetterConfig.ORDER_DLX_QUEUE)
    public void handleOrderTimeout(@Payload OrderEvent event,
                                    Channel channel,
                                    @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag)
            throws IOException {
        try {
            System.out.println("订单超时未支付，执行自动取消: orderId=" + event.getOrderId());

            // 1. 查询订单当前状态
            // 如果已支付 → 忽略（用户可能在第 29 分钟支付了）
            // 如果未支付 → 执行取消

            // 2. 取消订单：更新状态 + 恢复库存 + 通知用户
            cancelOrder(event);

            channel.basicAck(deliveryTag, false);
        } catch (Exception e) {
            // 取消失败，拒绝消息进入更深层的错误处理
            channel.basicNack(deliveryTag, false, false);
        }
    }

    private void cancelOrder(OrderEvent event) {
        // 更新订单状态为已取消
        // 调用库存服务恢复库存
        // 发送取消通知给用户
    }
}
```

---

### 5.3 延迟队列实现

#### 方案一：TTL + Dead Letter Exchange

即上面 5.2 的方案。但有一个致命限制：

> **队列级别 TTL 对所有消息统一过期时间。** 如果用消息级别 TTL，RabbitMQ 只检查队头消息——后进队列但 TTL 更短的消息不会先过期（队列是 FIFO 的）。例如先发 30 分钟的消息，再发 5 分钟的消息，5 分钟那条必须等 30 分钟那条先过期才能出队。

#### 方案二：延迟消息插件（推荐）

安装 `rabbitmq_delayed_message_exchange` 插件后，Exchange 本身支持延迟投递，不受 FIFO 限制。

安装插件（Docker 环境）：

```bash
# 进入容器
docker exec -it rabbitmq bash

# 启用插件
rabbitmq-plugins enable rabbitmq_delayed_message_exchange

# 退出容器
exit

# 重启容器生效
docker restart rabbitmq
```

Spring Boot 配置：

```java
package com.example.order.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class DelayedMessageConfig {

    public static final String DELAYED_EXCHANGE = "order.delayed.exchange";
    public static final String DELAYED_QUEUE = "order.delayed.queue";
    public static final String DELAYED_ROUTING_KEY = "order.delayed";

    /**
     * 声明延迟交换机
     * 类型为 x-delayed-message，这是插件提供的自定义类型
     */
    @Bean
    public CustomExchange delayedExchange() {
        Map<String, Object> args = new HashMap<>();
        // 实际的路由类型仍然可以是 direct / topic / fanout
        args.put("x-delayed-type", "direct");
        // CustomExchange 参数：name, type, durable, autoDelete, arguments
        return new CustomExchange(DELAYED_EXCHANGE, "x-delayed-message",
                true, false, args);
    }

    @Bean
    public Queue delayedQueue() {
        return QueueBuilder.durable(DELAYED_QUEUE).build();
    }

    @Bean
    public Binding delayedBinding() {
        return BindingBuilder.bind(delayedQueue())
                .to(delayedExchange())
                .with(DELAYED_ROUTING_KEY)
                .noargs();
    }
}
```

发送延迟消息：

```java
/**
 * 发送延迟消息（使用延迟插件）
 *
 * @param event    消息体
 * @param delayMs  延迟时间，单位毫秒
 */
public void sendDelayedMessage(OrderEvent event, long delayMs) {
    rabbitTemplate.convertAndSend(
            DelayedMessageConfig.DELAYED_EXCHANGE,
            DelayedMessageConfig.DELAYED_ROUTING_KEY,
            event,
            message -> {
                // 设置 x-delay 头，单位毫秒
                // 插件会在 Exchange 层面暂存消息，到期后才投递到 Queue
                message.getMessageProperties().setDelayLong(delayMs);
                return message;
            }
    );
}

// 使用示例：
// 30 分钟后检查订单是否支付
sendDelayedMessage(orderEvent, 30 * 60 * 1000L);
// 5 秒后发送短信通知
sendDelayedMessage(smsEvent, 5000L);
```

> **方案对比：** TTL+DLX 不需要额外插件但有 FIFO 限制，延迟插件无限制但需要安装插件。生产环境推荐延迟插件。

---

### 5.4 消息重试策略

#### 消费者侧自动重试（Spring Retry）

`application.yml` 中已配置的重试参数会在消费者端自动生效：

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        retry:
          enabled: true
          initial-interval: 1000ms    # 第 1 次重试等 1 秒
          multiplier: 2.0             # 每次间隔翻倍
          max-attempts: 3             # 最多重试 3 次（含首次）
          max-interval: 10000ms       # 间隔上限 10 秒
```

**重试流程：** 第 1 次失败 → 等 1s → 第 2 次失败 → 等 2s → 第 3 次失败 → 消息进入死信队列（如果配了 DLX）或丢弃。

> 注意：Spring Retry 的重试发生在消费者进程内部，消息并没有回到 Broker。如果消费者进程直接宕机，这些重试不会发生——所以 DLX 作为最后兜底仍然需要。

#### 重试耗尽后的兜底处理

配合 `MessageRecoverer` 将重试失败的消息发送到专门的错误队列：

```java
package com.example.order.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.retry.MessageRecoverer;
import org.springframework.amqp.rabbit.retry.RepublishMessageRecoverer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RetryConfig {

    public static final String ERROR_EXCHANGE = "error.direct.exchange";
    public static final String ERROR_QUEUE = "error.queue";
    public static final String ERROR_ROUTING_KEY = "error";

    @Bean
    public DirectExchange errorExchange() {
        return ExchangeBuilder.directExchange(ERROR_EXCHANGE).durable(true).build();
    }

    @Bean
    public Queue errorQueue() {
        return QueueBuilder.durable(ERROR_QUEUE).build();
    }

    @Bean
    public Binding errorBinding() {
        return BindingBuilder.bind(errorQueue())
                .to(errorExchange())
                .with(ERROR_ROUTING_KEY);
    }

    /**
     * 重试耗尽后，将消息重新发布到错误队列
     * 消息头中会自动附加异常堆栈信息，方便排查
     */
    @Bean
    public MessageRecoverer messageRecoverer(RabbitTemplate rabbitTemplate) {
        return new RepublishMessageRecoverer(rabbitTemplate,
                ERROR_EXCHANGE, ERROR_ROUTING_KEY);
    }
}
```

错误队列的消息通常由运维人员在管理界面手动查看、修复数据后，再决定重新投递或丢弃。

---

### 5.5 消息轨迹追踪

#### 方案：自定义消息包装器 + 分布式 traceId

在微服务架构中，一个请求可能跨越多个服务和多个 MQ 消息。通过在消息中携带 `traceId`，可以串联整个链路。

```java
package com.example.common.mq;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 带追踪信息的消息发送器
 * 每条消息自动携带 traceId 和 timestamp，方便链路追踪和问题排查
 */
@Component
public class TracedMessageSender {

    private final RabbitTemplate rabbitTemplate;

    public TracedMessageSender(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    /**
     * 发送消息时自动注入追踪信息到消息头
     */
    public void send(String exchange, String routingKey, Object payload, String traceId) {
        // 如果上游没有传 traceId（比如入口请求），生成一个新的
        String finalTraceId = (traceId != null) ? traceId : UUID.randomUUID().toString();

        rabbitTemplate.convertAndSend(exchange, routingKey, payload, message -> {
            // 在消息 Header 中注入追踪信息
            message.getMessageProperties().setHeader("X-Trace-Id", finalTraceId);
            message.getMessageProperties().setHeader("X-Send-Timestamp",
                    System.currentTimeMillis());
            // MessageId 用于幂等去重
            message.getMessageProperties().setMessageId(UUID.randomUUID().toString());
            return message;
        });
    }
}
```

消费者端提取 traceId 并放入 MDC（日志上下文）：

```java
@RabbitListener(queues = "order.queue")
public void handle(@Payload OrderEvent event,
                   @Header(value = "X-Trace-Id", required = false) String traceId,
                   Channel channel,
                   @Header(AmqpHeaders.DELIVERY_TAG) long tag) throws IOException {
    try {
        // 将 traceId 放入 MDC，后续所有日志自动带上该 ID
        org.slf4j.MDC.put("traceId", traceId != null ? traceId : "unknown");

        // 业务逻辑处理...
        log.info("处理订单事件: orderId={}", event.getOrderId());
        // 日志输出示例：[traceId=abc-123] 处理订单事件: orderId=ORD001

        // 如果需要继续发消息给下游，传递同一个 traceId
        // tracedSender.send("next.exchange", "next.key", nextEvent, traceId);

        channel.basicAck(tag, false);
    } catch (Exception e) {
        channel.basicNack(tag, false, false);
    } finally {
        org.slf4j.MDC.remove("traceId");
    }
}
```

> 配合 ELK（Elasticsearch + Logstash + Kibana）或 SkyWalking，可以通过 traceId 在全链路日志中检索一条消息的完整流转路径。

---

## 六、常见陷阱与避坑指南

### 1. 消息丢失三大场景

**场景描述：** 生产环境突然发现"有些订单发了但下游没收到"。排查后发现消息在某个环节丢了。

**三个丢失点：**
- 生产者没开 Confirm，消息发出去不知道 Broker 有没有收到
- Broker 没持久化（Exchange/Queue/消息任一个不是 durable），重启后全丢
- 消费者用了 `auto` ack，消息取出就算确认，处理到一半宕机直接丢失

**解决方案：** 开启 Publisher Confirm + Exchange/Queue/消息三持久化 + Consumer 手动 ACK。详见第四章 4.3 节。

---

### 2. 消费者连接突然断开，大量 unack 消息

**场景描述：** 消费者设置 `prefetch=1000`，一次性取出 1000 条消息到本地。处理到第 500 条时服务宕机——500 条已处理但未 ACK 的消息和 500 条未处理的消息全部重新入队。

**根本原因：** prefetch 设置过大，本地堆积大量未确认消息。

**解决方案：**
- `prefetch` 设为 1~10（取决于单条消息处理耗时）。处理快可以大一点，处理慢就设小。
- 宁可吞吐量低一点，也不要冒大批消息重复消费的风险。

---

### 3. 消息堆积导致内存/磁盘告警

**场景描述：** 消费者处理速度跟不上生产速度，队列中堆积百万条消息。RabbitMQ 内存超过阈值，触发流控（Flow Control），连生产者也被阻塞。

**解决方案：**
- **短期：** 增加消费者实例数量（水平扩展），加快消费速度
- **中期：** 优化消费者处理逻辑，减少单条消息处理耗时
- **长期：** 评估是否应该用 Kafka 替代（Kafka 的堆积能力远强于 RabbitMQ）
- **兜底：** 设置队列最大长度 `x-max-length`，超出时最旧的消息进死信队列，防止无限膨胀

---

### 4. 消息顺序性被打破

**场景描述：** 订单状态变更消息必须按顺序消费（创建→支付→发货），但多个消费者并行消费同一个队列，导致"发货"消息比"支付"消息先处理完。

**根本原因：** 一个队列绑定多个消费者时，消息被轮询分发，每个消费者处理速度不同，无法保证全局顺序。

**解决方案：**
- 同一个订单的所有消息发到同一个队列，且该队列只有一个消费者（Single Active Consumer 模式）
- 或用 RabbitMQ 的 `x-single-active-consumer` 参数：`QueueBuilder.durable("order.queue").singleActiveConsumer().build()`
- 如果顺序性要求非常严格，考虑 RocketMQ（原生支持顺序消息）或 Kafka（同一 Partition 内有序）

---

### 5. 连接/Channel 泄漏

**场景描述：** 生产环境运行一段时间后，RabbitMQ Management 界面显示几千个 Connection 和 Channel。最终 Broker 连接数耗尽，新连接被拒绝。

**根本原因：** 代码中手动创建 Connection 或 Channel 后没有正确关闭。常见于直接使用 RabbitMQ Java Client 而非 Spring AMQP 的场景。

**解决方案：**
- 使用 Spring AMQP 的 `RabbitTemplate` 和 `@RabbitListener`——底层连接池和 Channel 复用由框架自动管理
- 如果必须手动使用原生 Client，用 try-with-resources 确保 Channel 关闭
- 设置 `spring.rabbitmq.cache.channel.size` 控制 Channel 缓存上限

---

### 6. Exchange/Queue 配置不匹配

**场景描述：** 修改了队列的参数（如 TTL 从 30 分钟改为 60 分钟），重启应用后报错：`PRECONDITION_FAILED - inequivalent arg 'x-message-ttl'`。

**根本原因：** RabbitMQ 不允许修改已存在的 Queue/Exchange 的参数。Spring AMQP 启动时尝试用新参数声明已存在的队列，参数不一致导致报错。

**解决方案：**
- 先在 Management UI 或命令行删除旧队列，再重启应用让它用新参数重新创建
- 或创建一个新名字的队列（如 `order.queue.v2`），逐步迁移消费者
- 生产环境务必先确认队列中没有未消费的消息再删除，否则消息全丢

---

### 7. 消息体过大影响性能

**场景描述：** 把整个订单详情（含商品图片 URL 列表、收货地址、商品描述等）塞进消息体，单条消息达到 1MB。发送和消费速度急剧下降，Broker 内存压力骤增。

**根本原因：** RabbitMQ 设计目标是传递小消息（KB 级别），大消息会严重影响吞吐和稳定性。

**解决方案：**
- **消息体只传引用，不传实体。** 例如只发 `{ "orderId": "ORD001", "eventType": "PAY" }`，消费者收到后根据 orderId 去查数据库获取完整数据
- 如果确实需要传大数据（如文件），先上传到 OSS/S3，消息中只传文件 URL
- RabbitMQ 默认消息大小上限 128MB，但实践中建议控制在 100KB 以内

---

## 七、与其他技术配合使用

### 7.1 MQ + 分布式事务（本地消息表模式）

**问题：** 业务操作和发送消息需要原子性——不能出现"订单创建成功但消息没发出去"或"消息发出去了但订单没创建成功"。

**本地消息表方案流程：**

```
┌──────────────────────────────────────────────────────────┐
│               订单服务（同一个数据库事务）                    │
│                                                          │
│  ① INSERT INTO orders (...) VALUES (...)                 │
│  ② INSERT INTO mq_message_log (message_id, content,     │
│     status='PENDING') VALUES (...)                       │
│  ③ COMMIT                                                │
│                                                          │
│  两条 SQL 在同一个本地事务中，要么都成功要么都回滚             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│              异步线程 / 定时任务（每隔几秒扫描一次）           │
│                                                          │
│  ① 查询 status='PENDING' 的消息                           │
│  ② 发送到 RabbitMQ                                        │
│  ③ 发送成功后更新 status='SENT'                             │
│  ④ 发送失败则不更新，下次继续重试                              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  下游消费者                                 │
│                                                          │
│  ① 消费消息，执行业务逻辑                                    │
│  ② 处理成功后回调或发消息通知上游                              │
│  ③ 上游收到确认后更新 status='CONFIRMED'                    │
└──────────────────────────────────────────────────────────┘
```

核心代码示例：

```java
package com.example.order.service;

import com.example.order.dto.OrderEvent;
import com.example.order.mapper.MqMessageLogMapper;
import com.example.order.mapper.OrderMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class OrderService {

    private final OrderMapper orderMapper;
    private final MqMessageLogMapper messageLogMapper;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public OrderService(OrderMapper orderMapper,
                        MqMessageLogMapper messageLogMapper,
                        RabbitTemplate rabbitTemplate,
                        ObjectMapper objectMapper) {
        this.orderMapper = orderMapper;
        this.messageLogMapper = messageLogMapper;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 创建订单 + 写入消息日志（同一个事务）
     * 任何一步失败整个事务回滚，保证数据一致性
     */
    @Transactional(rollbackFor = Exception.class)
    public String createOrder(String userId, String productId, int quantity)
            throws JsonProcessingException {
        // 1. 创建订单
        String orderId = UUID.randomUUID().toString();
        orderMapper.insert(orderId, userId, productId, quantity);

        // 2. 在同一个事务中写入消息日志
        OrderEvent event = new OrderEvent(orderId, userId, null, "CREATE");
        String messageContent = objectMapper.writeValueAsString(event);
        messageLogMapper.insert(UUID.randomUUID().toString(),
                "order.topic.exchange", "order.create",
                messageContent, "PENDING");

        // 事务提交后，订单和消息日志要么都在，要么都不在
        return orderId;
    }

    /**
     * 定时任务：扫描未发送的消息，投递到 MQ
     * 每 5 秒执行一次
     */
    @Scheduled(fixedDelay = 5000)
    public void publishPendingMessages() {
        List<MqMessageLog> pendingMessages = messageLogMapper
                .findByStatus("PENDING");

        for (MqMessageLog msg : pendingMessages) {
            try {
                rabbitTemplate.convertAndSend(
                        msg.getExchangeName(),
                        msg.getRoutingKey(),
                        msg.getContent()
                );
                // 发送成功，更新状态
                messageLogMapper.updateStatus(msg.getMessageId(), "SENT");
            } catch (Exception e) {
                // 发送失败，不更新状态，下次定时任务会继续重试
                // 可以记录重试次数，超过阈值告警人工介入
            }
        }
    }
}
```

消息日志表 DDL：

```sql
CREATE TABLE mq_message_log (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id    VARCHAR(64)  NOT NULL COMMENT '消息唯一ID',
    exchange_name VARCHAR(128) NOT NULL COMMENT '目标Exchange',
    routing_key   VARCHAR(128) NOT NULL COMMENT '路由键',
    content       TEXT         NOT NULL COMMENT '消息内容(JSON)',
    status        VARCHAR(16)  NOT NULL COMMENT 'PENDING/SENT/CONFIRMED/FAILED',
    retry_count   INT DEFAULT 0       COMMENT '重试次数',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_message_id (message_id),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='MQ本地消息表';
```

> **本地消息表是实现分布式事务最可靠、最易理解的方案。** 不依赖第三方组件（如 Seata），靠本地事务保证一致性，靠定时任务保证消息最终投递成功。代价是略有延迟（定时任务间隔）和需要维护消息表。

---

### 7.2 MQ + 数据同步（MySQL → ES/Redis）

**场景：** 数据库更新后需要同步到 Elasticsearch（搜索）或 Redis（缓存），直接在业务代码中写双写逻辑耦合太重。

**架构：**

```
┌─────────┐    binlog     ┌───────┐   消息    ┌───────────┐   消费    ┌──────┐
│  MySQL   │ ───────────▶ │ Canal  │ ───────▶ │ RabbitMQ  │ ───────▶ │  ES  │
└─────────┘               └───────┘           └───────────┘          └──────┘
                                                   │
                                                   │         消费    ┌───────┐
                                                   └───────────────▶│ Redis │
                                                                     └───────┘
```

**各组件职责：**
- **Canal：** 阿里开源的 MySQL binlog 增量订阅工具，伪装成 MySQL Slave 接收 binlog
- **RabbitMQ：** 接收 Canal 解析后的数据变更事件，解耦 Canal 和下游消费者
- **ES/Redis 消费者：** 监听 MQ 队列，将变更数据同步到各自存储

**优势：** 业务代码零侵入——只写 MySQL 就行，同步逻辑完全由 Canal + MQ 承担。新增同步目标只需新增消费者。

---

### 7.3 MQ + Spring Cloud

#### RabbitMQ 作为 Spring Cloud Bus 的传输层

**场景：** 微服务集群使用 Spring Cloud Config 集中管理配置。配置中心更新配置后，需要通知所有服务实例刷新。

```
┌──────────────┐   推送变更事件   ┌───────────┐
│ Config Server │ ─────────────▶ │ RabbitMQ  │
└──────────────┘                 └─────┬─────┘
                                       │  广播给所有订阅者
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
              ┌──────────┐      ┌──────────┐      ┌──────────┐
              │ 服务A-1   │      │ 服务A-2   │      │ 服务B-1   │
              │ 刷新配置   │      │ 刷新配置   │      │ 刷新配置   │
              └──────────┘      └──────────┘      └──────────┘
```

Spring Cloud Bus 底层就是用 MQ（RabbitMQ 或 Kafka）做消息广播。只需引入依赖，无需写任何 MQ 相关代码：

```xml
<!-- Spring Cloud Bus + RabbitMQ -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-bus-amqp</artifactId>
</dependency>
```

配置中心修改配置后调用 `/actuator/busrefresh`，所有服务实例自动刷新。

> **使用场景判断：** 如果你的微服务已经在用 Spring Cloud Config + RabbitMQ，直接引入 Bus 即可获得配置热更新能力。如果只是简单的几个服务，手动重启或 Nacos 自带的推送更合适。

---

> **最后一句话总结：** RabbitMQ 在 Java 企业级业务系统中的定位——可靠的消息中间件，解耦是核心价值，削峰是附带能力，用好确认机制和死信队列就能覆盖 80% 的生产场景。不要过度设计，也不要裸奔上线。
