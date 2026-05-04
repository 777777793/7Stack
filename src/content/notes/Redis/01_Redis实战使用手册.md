# Redis 实战使用手册

> 定位：一份看完就能上手的「企业级使用说明书」，基于 Java 生态。

---

## 一、Redis 解决什么问题？

### 1.1 一句话定位

Redis 是一个**基于内存的高性能键值存储系统**，本质上是把数据放在内存里读写，速度比 MySQL 快 100 倍以上。

### 1.2 什么时候该用 Redis？

不是所有数据都适合放 Redis。判断标准很简单：

| 适合用 Redis | 不适合用 Redis |
|---|---|
| 读多写少的热点数据 | 需要复杂查询（JOIN、聚合）的数据 |
| 需要极低延迟（<1ms）的场景 | 数据量远超内存容量的场景 |
| 需要原子操作的共享状态 | 对数据一致性要求极高（金融交易核心账务） |
| 临时性数据（验证码、Session） | 冷数据、归档数据 |

### 1.3 企业中的真实使用场景

```
场景一：缓存加速
  电商首页商品列表，每秒 10 万次请求 → MySQL 扛不住 → Redis 缓存，响应时间从 50ms 降到 1ms

场景二：分布式锁
  秒杀场景下，100 个服务实例同时扣减库存 → 用 Redis 分布式锁保证同一时刻只有一个实例操作

场景三：排行榜
  游戏积分排行榜，实时变化 → 用 Redis 的 ZSet，天然支持排序，O(logN) 插入和查询

场景四：计数器 / 限流
  API 限流：每个用户每分钟最多请求 100 次 → 用 Redis 的 INCR + EXPIRE 实现

场景五：分布式 Session
  用户登录态在多个服务实例之间共享 → Session 存 Redis，任何实例都能读到

场景六：消息队列（轻量级）
  异步通知、简单任务分发 → 用 Redis 的 Stream 或 List 实现（重度场景还是用 Kafka/RocketMQ）
```

---

## 二、环境搭建与 Java 接入

### 2.1 Redis 安装（开发环境）

**macOS：**
```bash
# 用 Homebrew，一行搞定
brew install redis

# 启动 Redis（前台运行，方便看日志）
redis-server

# 另开终端，验证是否正常
redis-cli ping
# 返回 PONG 就说明 OK
```

**Linux（CentOS/Ubuntu）：**
```bash
# Ubuntu
sudo apt update && sudo apt install redis-server -y

# CentOS
sudo yum install redis -y

# 启动并设置开机自启
sudo systemctl start redis
sudo systemctl enable redis
```

**Docker（推荐，干净且可复现）：**
```bash
# 拉取并启动 Redis 7.x，映射到本机 6379 端口
docker run -d --name redis \
  -p 6379:6379 \
  -v /data/redis:/data \
  redis:7.2 redis-server --appendonly yes --requirepass yourpassword

# 验证
docker exec -it redis redis-cli -a yourpassword ping
```

> ⚠️ **生产环境必须设置密码**，裸奔的 Redis 曾导致大量服务器被入侵挖矿。

### 2.2 Spring Boot 接入 Redis（企业主流方案）

**第一步：引入依赖**

```xml
<!-- pom.xml -->
<dependencies>
    <!-- Spring Boot Redis Starter（底层默认使用 Lettuce 连接池） -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>

    <!-- 连接池支持（Lettuce 需要 commons-pool2） -->
    <dependency>
        <groupId>org.apache.commons</groupId>
        <artifactId>commons-pool2</artifactId>
    </dependency>

    <!-- JSON 序列化（后面会用到） -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
</dependencies>
```

> 💡 **为什么用 Lettuce 而不是 Jedis？**
> Lettuce 基于 Netty，天生支持异步和连接共享，一个连接就能处理并发请求；Jedis 是同步阻塞的，需要连接池才能并发，资源消耗更大。Spring Boot 2.x 起默认就是 Lettuce。

**第二步：配置连接信息**

```yaml
# application.yml
spring:
  data:
    redis:
      host: 127.0.0.1
      port: 6379
      password: yourpassword      # 生产环境必填
      database: 0                  # 默认用 0 号库，不同业务可以用不同库隔离
      timeout: 3000ms              # 连接超时时间，别设太大，快速失败比卡死好
      lettuce:
        pool:
          max-active: 16           # 最大连接数，根据 QPS 调整（一般 8~32）
          max-idle: 8              # 最大空闲连接数
          min-idle: 2              # 最小空闲连接数，保持少量热连接
          max-wait: 3000ms         # 获取连接最大等待时间
```

> ⚠️ `max-active` 不是越大越好。Redis 是单线程处理命令的，连接太多反而增加上下文切换开销。一般 `CPU核数 * 2 + 2` 是个不错的起点。

**第三步：配置 RedisTemplate（关键！）**

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // Key 序列化：用 String，人类可读，方便在 redis-cli 里调试
        template.setKeySerializer(RedisSerializer.string());
        template.setHashKeySerializer(RedisSerializer.string());

        // Value 序列化：用 JSON，跨语言兼容，调试友好
        Jackson2JsonRedisSerializer<Object> jsonSerializer =
            new Jackson2JsonRedisSerializer<>(Object.class);

        ObjectMapper om = new ObjectMapper();
        // 序列化时带上类型信息，反序列化时才能还原为正确的 Java 对象
        om.activateDefaultTyping(
            om.getPolymorphicTypeValidator(),
            ObjectMapper.DefaultTyping.NON_FINAL,
            JsonTypeInfo.As.PROPERTY
        );
        jsonSerializer.setObjectMapper(om);

        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }
}
```

> ⚠️ **不配置序列化的后果：** 默认使用 JDK 序列化，存进 Redis 的数据是乱码（`\xac\xed\x00\x05...`），无法用 redis-cli 查看，排查问题极其痛苦，而且 JDK 序列化还有安全漏洞风险。

**第四步：验证是否接入成功**

```java
@SpringBootTest
class RedisConnectionTest {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Test
    void testConnection() {
        redisTemplate.opsForValue().set("test:key", "Hello Redis", Duration.ofSeconds(60));
        Object value = redisTemplate.opsForValue().get("test:key");
        System.out.println(value); // 输出：Hello Redis
    }
}
```

---

## 三、五大数据结构实战

### 3.1 String — 缓存 + 计数器

**场景：商品详情缓存**

```java
@Service
public class ProductService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    @Autowired
    private ProductMapper productMapper;

    private static final String PRODUCT_CACHE_PREFIX = "product:detail:";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    public Product getProductById(Long productId) {
        String key = PRODUCT_CACHE_PREFIX + productId;

        // 1. 先查缓存
        Product product = (Product) redisTemplate.opsForValue().get(key);
        if (product != null) {
            return product;
        }

        // 2. 缓存未命中，查数据库
        product = productMapper.selectById(productId);
        if (product == null) {
            // ⚠️ 防缓存穿透：查不到也缓存一个空值，但过期时间要短
            redisTemplate.opsForValue().set(key, new Product(), Duration.ofMinutes(2));
            return null;
        }

        // 3. 写入缓存（加随机偏移量防雪崩）
        long randomOffset = ThreadLocalRandom.current().nextLong(0, 300);
        redisTemplate.opsForValue().set(key, product, CACHE_TTL.plusSeconds(randomOffset));
        return product;
    }
}
```

**场景：API 限流计数器**

```java
public boolean isRateLimited(String userId, int maxRequests, int windowSeconds) {
    String key = "rate_limit:" + userId;

    // INCR 是原子操作，天然线程安全
    Long count = redisTemplate.opsForValue().increment(key);

    if (count == 1) {
        // 第一次请求，设置过期时间（滑动窗口的起点）
        redisTemplate.expire(key, Duration.ofSeconds(windowSeconds));
    }

    return count > maxRequests;
}
```

### 3.2 Hash — 对象存储

**场景：用户信息缓存（部分字段更新）**

```java
// 相比 String 存整个 JSON，Hash 的优势是可以只更新某个字段，不用全量覆盖
public void cacheUserInfo(User user) {
    String key = "user:info:" + user.getId();
    Map<String, Object> fields = new HashMap<>();
    fields.put("name", user.getName());
    fields.put("email", user.getEmail());
    fields.put("level", user.getLevel());
    fields.put("lastLogin", user.getLastLoginTime().toString());

    redisTemplate.opsForHash().putAll(key, fields);
    redisTemplate.expire(key, Duration.ofHours(2));
}

// 只更新登录时间，不影响其他字段
public void updateLastLogin(Long userId) {
    String key = "user:info:" + userId;
    redisTemplate.opsForHash().put(key, "lastLogin", LocalDateTime.now().toString());
}

// 只取需要的字段，减少网络传输
public String getUserEmail(Long userId) {
    String key = "user:info:" + userId;
    return (String) redisTemplate.opsForHash().get(key, "email");
}
```

> 💡 **String vs Hash 怎么选？**
> - 对象字段经常需要单独读写 → 用 Hash
> - 总是整体读写，不关心单个字段 → 用 String 存 JSON（更简单）
> - 字段数量超多（上百个） → 用 String，Hash 在字段多时内存反而更大

### 3.3 List — 消息队列 / 最新列表

**场景：简单消息队列**

```java
// 生产者：往队列左侧推消息
public void sendMessage(String queue, String message) {
    redisTemplate.opsForList().leftPush("mq:" + queue, message);
}

// 消费者：从队列右侧阻塞拉取（BRPOP），没有消息时不会空转浪费 CPU
public String consumeMessage(String queue, long timeoutSeconds) {
    Object result = redisTemplate.opsForList().rightPop(
        "mq:" + queue, Duration.ofSeconds(timeoutSeconds)
    );
    return result != null ? result.toString() : null;
}
```

**场景：最新动态列表（只保留最近 100 条）**

```java
public void addFeed(Long userId, String content) {
    String key = "feed:" + userId;
    redisTemplate.opsForList().leftPush(key, content);
    // 只保留最近 100 条，自动裁剪
    redisTemplate.opsForList().trim(key, 0, 99);
}
```

### 3.4 Set — 去重 / 社交关系

**场景：共同关注（交集运算）**

```java
// 用户关注了谁
public void follow(Long userId, Long targetId) {
    redisTemplate.opsForSet().add("following:" + userId, targetId.toString());
    redisTemplate.opsForSet().add("followers:" + targetId, userId.toString());
}

// 共同关注
public Set<Object> commonFollowing(Long userA, Long userB) {
    return redisTemplate.opsForSet().intersect("following:" + userA, "following:" + userB);
}

// 我关注的人中谁也关注了他（推荐好友场景）
public Set<Object> whoAlsoFollowed(Long myId, Long targetId) {
    return redisTemplate.opsForSet().intersect("following:" + myId, "followers:" + targetId);
}
```

### 3.5 ZSet（Sorted Set）— 排行榜

**场景：游戏积分排行榜**

```java
@Service
public class LeaderboardService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private static final String LEADERBOARD_KEY = "game:leaderboard:season1";

    // 更新分数（ZADD 是幂等的，重复调用会覆盖旧分数）
    public void updateScore(String playerId, double score) {
        redisTemplate.opsForZSet().add(LEADERBOARD_KEY, playerId, score);
    }

    // 增加分数（增量更新，比如通关 +100 分）
    public Double addScore(String playerId, double increment) {
        return redisTemplate.opsForZSet().incrementScore(LEADERBOARD_KEY, playerId, increment);
    }

    // 获取 Top N（分数从高到低）
    public Set<ZSetOperations.TypedTuple<Object>> getTopN(int n) {
        return redisTemplate.opsForZSet().reverseRangeWithScores(LEADERBOARD_KEY, 0, n - 1);
    }

    // 查询某个玩家的排名（从 0 开始，记得 +1）
    public Long getPlayerRank(String playerId) {
        Long rank = redisTemplate.opsForZSet().reverseRank(LEADERBOARD_KEY, playerId);
        return rank != null ? rank + 1 : null;
    }

    // 查询某个玩家的分数
    public Double getPlayerScore(String playerId) {
        return redisTemplate.opsForZSet().score(LEADERBOARD_KEY, playerId);
    }
}
```

---

## 四、企业级配置与最佳实践

### 4.1 Key 命名规范

```
格式：业务模块:数据类型:唯一标识

✅ 好的命名：
  user:info:10086
  order:detail:202403150001
  product:stock:SKU_12345
  rate_limit:api:/v1/order:user_10086

❌ 坏的命名：
  key1                → 完全没有语义
  getUserInfo         → 像函数名不像 Key
  user_10086_info     → 分隔符不统一，用下划线还是冒号要统一
```

> ⚠️ **Key 长度控制在 100 字节以内**，Key 太长会浪费内存和带宽。但也别用缩写缩到看不懂，可读性优先。

### 4.2 序列化方案选择

| 方案 | 优点 | 缺点 | 推荐场景 |
|---|---|---|---|
| Jackson JSON | 人类可读，调试方便，跨语言 | 体积较大，需处理类型信息 | **大多数业务场景（推荐）** |
| GenericJackson2 | 带类型信息，反序列化精确 | 存储带 `@class` 字段，体积更大 | 需要多态反序列化 |
| Protobuf / Kryo | 体积小，速度快 | 不可读，调试困难，需要额外依赖 | 高吞吐、大数据量场景 |
| JDK Serializable | 无需额外配置 | 乱码、安全漏洞、不跨语言 | **永远不要用** |

### 4.3 过期时间设置策略

```java
// ❌ 错误：所有缓存都设同一个过期时间
redisTemplate.opsForValue().set(key, value, Duration.ofMinutes(30));

// ✅ 正确：基础 TTL + 随机偏移量，防止大量 Key 同时过期导致缓存雪崩
private Duration randomTTL(Duration baseTTL) {
    long offsetSeconds = ThreadLocalRandom.current().nextLong(0, baseTTL.getSeconds() / 5);
    return baseTTL.plusSeconds(offsetSeconds);
}
```

### 4.4 使用 Pipeline 批量操作

```java
// ❌ 错误：循环中逐个操作，每次都是一次网络往返
for (String key : keys) {
    redisTemplate.opsForValue().get(key);  // 1000 个 Key = 1000 次网络往返
}

// ✅ 正确：用 Pipeline 批量发送，一次网络往返搞定
List<Object> results = redisTemplate.executePipelined((RedisCallback<Object>) connection -> {
    StringRedisConnection conn = (StringRedisConnection) connection;
    for (String key : keys) {
        conn.get(key);
    }
    return null;  // 必须返回 null，结果从外层 List 获取
});
```

> 💡 1000 个 GET 操作，逐个执行约 50ms（每次 0.05ms 网络延迟），Pipeline 只需约 1ms。

---

## 五、常见陷阱与注意事项

### 5.1 缓存三大问题

```
┌─────────────────────────────────────────────────────────────┐
│                    缓存穿透                                  │
│  问题：查询一个不存在的数据，缓存永远不命中，请求全部打到 DB   │
│  原因：恶意攻击或业务 Bug（如用负数 ID 查询）                 │
│  方案：                                                      │
│    ① 缓存空值（简单有效，注意设置短过期时间）                 │
│    ② 布隆过滤器（拦截不存在的 Key，适合数据量大的场景）       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    缓存雪崩                                  │
│  问题：大量 Key 同时过期，请求瞬间全部打到 DB                 │
│  方案：                                                      │
│    ① 过期时间加随机偏移量（前面已经演示）                     │
│    ② 热点数据永不过期 + 后台异步更新                         │
│    ③ 多级缓存（本地缓存 Caffeine + Redis）                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    缓存击穿                                  │
│  问题：某个热点 Key 过期的瞬间，大量并发请求同时查 DB         │
│  方案：                                                      │
│    ① 互斥锁：只让一个线程去查 DB，其他线程等待              │
│    ② 逻辑过期：不设 TTL，在 Value 里存过期时间，             │
│       发现过期后异步更新，旧数据先顶着用                     │
└─────────────────────────────────────────────────────────────┘
```

**缓存击穿 — 互斥锁方案实现：**

```java
public Product getProductWithMutex(Long productId) {
    String key = PRODUCT_CACHE_PREFIX + productId;
    String lockKey = "lock:product:" + productId;

    // 1. 查缓存
    Product product = (Product) redisTemplate.opsForValue().get(key);
    if (product != null) {
        return product;
    }

    // 2. 尝试获取互斥锁（SET NX EX）
    Boolean locked = redisTemplate.opsForValue()
        .setIfAbsent(lockKey, "1", Duration.ofSeconds(10));

    if (Boolean.TRUE.equals(locked)) {
        try {
            // 3. 双重检查：拿到锁之后再查一次缓存（可能别的线程已经写入了）
            product = (Product) redisTemplate.opsForValue().get(key);
            if (product != null) {
                return product;
            }

            // 4. 查数据库并写入缓存
            product = productMapper.selectById(productId);
            redisTemplate.opsForValue().set(key, product, randomTTL(CACHE_TTL));
            return product;
        } finally {
            // 5. 释放锁
            redisTemplate.delete(lockKey);
        }
    } else {
        // 6. 没拿到锁，短暂休眠后重试
        try { Thread.sleep(50); } catch (InterruptedException ignored) {}
        return getProductWithMutex(productId);  // 递归重试
    }
}
```

### 5.2 BigKey 问题

```
BigKey 的定义：
  String 类型 → Value 超过 10KB
  Hash/List/Set/ZSet → 元素超过 5000 个

BigKey 的危害：
  ① 读写耗时长，阻塞 Redis 主线程（Redis 是单线程！）
  ② 删除 BigKey 时可能造成几秒的阻塞（DEL 是同步操作）
  ③ 网络带宽暴涨，影响其他请求
  ④ 集群模式下导致数据倾斜，某个节点压力特别大

排查方式：
  redis-cli --bigkeys              # 快速扫描
  redis-cli memory usage <key>     # 查看某个 Key 的内存占用

解决方案：
  ① 拆分：把一个大 Hash 拆成多个小 Hash（按 ID 取模分桶）
  ② 压缩：Value 做 GZIP 压缩后再存
  ③ 删除 BigKey 用 UNLINK 而不是 DEL（UNLINK 是异步删除，不阻塞主线程）
```

### 5.3 热 Key 问题

```
某个 Key 被大量请求集中访问，单个 Redis 节点扛不住。

方案：
  ① 本地缓存：用 Caffeine 做 L1 缓存，Redis 做 L2 缓存
  ② 读写分离：从节点分担读压力
  ③ Key 分散：将 key 复制 N 份（key:1, key:2, ...），随机读取，分散到不同节点
```

### 5.4 连接泄露

```java
// ⚠️ 使用 RedisTemplate 不需要手动管理连接，Spring 会自动管理。
// 但如果你用了 execute() 回调，注意不要在回调里抛异常后吞掉，导致连接没有归还。

// ⚠️ 如果用 Jedis（不推荐），必须确保 finally 中归还连接：
Jedis jedis = jedisPool.getResource();
try {
    jedis.set("key", "value");
} finally {
    jedis.close();  // 不是真的关闭，是归还到连接池
}
```

---

## 六、与其他技术配合使用

### 6.1 Redis + MySQL：缓存一致性方案

企业中最常用的是 **Cache Aside Pattern（旁路缓存）**：

```
读流程：
  ① 先读缓存 → 命中则直接返回
  ② 缓存未命中 → 读数据库 → 写入缓存

写流程（关键！）：
  ① 先更新数据库
  ② 再删除缓存（不是更新缓存！）

为什么是「删除」而不是「更新」缓存？
  → 如果两个并发请求同时更新缓存，可能因为网络延迟导致后到的旧值覆盖新值。
  → 删除更安全：下次读的时候自然会从数据库加载最新值。
```

```java
@Service
public class ProductService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    @Autowired
    private ProductMapper productMapper;

    // 写操作：先更新 DB，再删缓存
    @Transactional
    public void updateProduct(Product product) {
        // ① 更新数据库
        productMapper.updateById(product);

        // ② 删除缓存（让下次读时重新加载）
        String key = "product:detail:" + product.getId();
        redisTemplate.delete(key);
    }
}
```

> ⚠️ **延迟双删**：如果对一致性要求更高，可以在删除缓存后延迟 500ms 再删一次，防止并发读请求在删除后又把旧数据写入缓存。

### 6.2 Redis + Spring Cache：注解式缓存

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))                              // 默认过期时间
            .serializeKeysWith(
                SerializationPair.fromSerializer(RedisSerializer.string()))
            .serializeValuesWith(
                SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));

        return RedisCacheManager.builder(factory)
            .cacheDefaults(config)
            // 针对不同业务设置不同的 TTL
            .withCacheConfiguration("userCache",
                config.entryTtl(Duration.ofHours(2)))
            .withCacheConfiguration("productCache",
                config.entryTtl(Duration.ofMinutes(10)))
            .build();
    }
}

@Service
public class UserService {

    // 查询时自动缓存，Key 为 userCache::10086
    @Cacheable(value = "userCache", key = "#userId")
    public User getUserById(Long userId) {
        return userMapper.selectById(userId);  // 只有缓存未命中时才会执行
    }

    // 更新时自动清除缓存
    @CacheEvict(value = "userCache", key = "#user.id")
    @Transactional
    public void updateUser(User user) {
        userMapper.updateById(user);
    }

    // 更新时同时更新缓存（适合读多写少且需要立即看到最新值的场景）
    @CachePut(value = "userCache", key = "#user.id")
    @Transactional
    public User updateAndReturn(User user) {
        userMapper.updateById(user);
        return user;
    }
}
```

### 6.3 Redis + Redisson：分布式锁

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.27.0</version>
</dependency>
```

```java
@Service
public class StockService {

    @Autowired
    private RedissonClient redissonClient;
    @Autowired
    private StockMapper stockMapper;

    /**
     * 秒杀扣减库存 — 使用 Redisson 分布式锁
     */
    public boolean deductStock(Long productId, int quantity) {
        // 获取锁对象（锁的粒度精确到商品 ID，不同商品互不影响）
        RLock lock = redissonClient.getLock("lock:stock:" + productId);

        try {
            // 尝试加锁：最多等 3 秒，加锁后 10 秒自动释放（防止宕机死锁）
            // Redisson 内部有看门狗机制：如果业务没执行完，会自动续期
            boolean locked = lock.tryLock(3, 10, TimeUnit.SECONDS);
            if (!locked) {
                return false;  // 获取锁失败，说明竞争太激烈
            }

            // 查库存
            Stock stock = stockMapper.selectByProductId(productId);
            if (stock.getQuantity() < quantity) {
                return false;  // 库存不足
            }

            // 扣减库存
            stockMapper.deduct(productId, quantity);
            return true;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } finally {
            // 只有持锁线程才能释放锁，Redisson 内部会校验
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }
}
```

> ⚠️ **不要用 `SETNX` 自己实现分布式锁！** 要处理的细节太多（原子性、续期、可重入、主从切换时锁丢失），Redisson 都帮你处理好了。

### 6.4 Redis + Caffeine：多级缓存

```java
@Configuration
public class MultiLevelCacheConfig {

    // L1 本地缓存：Caffeine，速度最快，但容量有限
    @Bean
    public Cache<String, Object> localCache() {
        return Caffeine.newBuilder()
            .maximumSize(10_000)            // 最多缓存 1 万条
            .expireAfterWrite(Duration.ofMinutes(5))  // 本地缓存过期要比 Redis 短
            .build();
    }
}

@Service
public class MultiLevelCacheService {

    @Autowired
    private Cache<String, Object> localCache;
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    @Autowired
    private ProductMapper productMapper;

    public Product getProduct(Long productId) {
        String key = "product:detail:" + productId;

        // L1：查本地缓存（纳秒级）
        Product product = (Product) localCache.getIfPresent(key);
        if (product != null) return product;

        // L2：查 Redis（毫秒级）
        product = (Product) redisTemplate.opsForValue().get(key);
        if (product != null) {
            localCache.put(key, product);  // 回填 L1
            return product;
        }

        // L3：查数据库
        product = productMapper.selectById(productId);
        if (product != null) {
            redisTemplate.opsForValue().set(key, product, Duration.ofMinutes(30));
            localCache.put(key, product);
        }
        return product;
    }
}
```

---

## 七、生产环境 Checklist

在项目上线前，对照检查：

- [ ] **安全**：Redis 设置了密码，禁用了 `CONFIG`、`FLUSHALL` 等危险命令
- [ ] **内存**：设置了 `maxmemory` 和 `maxmemory-policy`（推荐 `allkeys-lru`）
- [ ] **持久化**：根据业务选择了 RDB / AOF / 混合持久化
- [ ] **监控**：接入了 Redis 监控（如 Prometheus + Grafana），关注内存使用率、命中率、慢查询
- [ ] **高可用**：生产环境不是单节点，至少是哨兵模式或 Cluster
- [ ] **Key 规范**：有统一的命名规范，所有 Key 都设置了过期时间
- [ ] **BigKey**：定期扫描，没有超大 Key
- [ ] **序列化**：确认没有使用 JDK 默认序列化
- [ ] **连接池**：配置合理，有监控连接池使用情况
- [ ] **慢查询**：配置了 `slowlog-log-slower-than`（建议 10ms），定期检查慢查询日志
