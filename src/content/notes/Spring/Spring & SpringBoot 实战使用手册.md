# Spring & Spring Boot 实战使用手册

> 面向 Java 后端开发者的企业级实战指南
> 基于 Spring Boot 3.x + Java 17，以「订单系统」为贯穿示例

---

## 一、为什么需要 Spring？

### 1.1 没有 Spring 之前的痛点

在没有 Spring 的年代，Java 开发者写代码是这样的：

```java
// 痛点一：手动 new 对象，到处都是硬编码
public class OrderService {
    // 直接 new 出来，OrderService 和 MysqlOrderDao 死死绑定
    private OrderDao orderDao = new MysqlOrderDao();
    // 如果哪天要换成 PostgreSQL，你要改多少地方？

    // 直接 new 出来，如果 InventoryService 构造函数变了呢？
    private InventoryService inventoryService = new InventoryService();

    public void createOrder(Order order) {
        orderDao.save(order);
        inventoryService.deductStock(order.getProductId(), order.getQuantity());
    }
}
```

**具体痛点如下：**

| 痛点 | 表现 | 后果 |
|------|------|------|
| 对象创建散落各处 | 每个类都自己 new 依赖对象 | 修改一处，牵连十处 |
| 耦合度极高 | 直接依赖具体实现类 | 换个实现要改源码 |
| 测试极其困难 | 没法 mock 依赖 | 单元测试写不了 |
| 资源管理混乱 | 数据库连接、线程池自己管 | 连接泄漏、资源耗尽 |
| 横切关注点重复 | 事务、日志、权限每个方法都写 | 代码膨胀，维护噩梦 |
| 配置硬编码 | 数据库地址写在代码里 | 换个环境要重新编译 |

### 1.2 用通俗类比解释 IoC 容器

**装修公司类比：**

假设你要装修房子（开发一个系统）：

**没有 Spring = 自己装修：**
- 你要自己去建材市场买水泥（new MysqlOrderDao()）
- 自己找电工（new InventoryService()）
- 自己协调各工种的施工顺序（管理对象生命周期）
- 水泥涨价了？换个品牌？你自己去换（修改源码）

**有了 Spring = 请了装修公司：**
- 你只需要说"我要一个厨房"（声明依赖）
- 装修公司（IoC 容器）帮你找到所有材料和工人
- 它负责协调施工顺序（管理 Bean 的创建和依赖注入）
- 想换个品牌的水泥？告诉装修公司就行（改配置，不改代码）

**核心思想：控制反转（IoC）**

```
传统方式：我需要什么，我自己去创建   → 控制权在"我"手里
Spring方式：我需要什么，我声明一下，容器给我  → 控制权交给了"容器"
```

这就是"控制反转"——你不再控制对象的创建，而是把这个控制权反转给了 Spring 容器。

### 1.3 Spring 解决了哪些核心问题

**问题一：对象管理 → IoC 容器**
```java
// 以前：自己管理
OrderDao dao = new MysqlOrderDao();

// 现在：Spring 帮你管理，你只需要声明
@Autowired
private OrderDao orderDao; // Spring 自动帮你找到实现类并注入
```

**问题二：模块解耦 → 依赖注入（DI）**
```java
// 以前：直接依赖具体类
private OrderDao orderDao = new MysqlOrderDao();

// 现在：依赖接口，具体实现由 Spring 注入
@Service
public class OrderService {
    private final OrderDao orderDao; // 只依赖接口

    // 构造器注入，Spring 自动传入实现类
    public OrderService(OrderDao orderDao) {
        this.orderDao = orderDao;
    }
}
```

**问题三：横切关注点 → AOP（面向切面编程）**
```java
// 以前：每个方法都写事务代码
public void createOrder(Order order) {
    Connection conn = dataSource.getConnection();
    try {
        conn.setAutoCommit(false);
        // 业务代码...
        conn.commit();
    } catch (Exception e) {
        conn.rollback();
    } finally {
        conn.close();
    }
}

// 现在：一个注解搞定
@Transactional
public void createOrder(Order order) {
    // 只写业务代码，事务由 Spring AOP 自动管理
    orderRepository.save(order);
    inventoryService.deductStock(order.getProductId(), order.getQuantity());
}
```

**问题四：配置地狱 → 自动配置（Spring Boot）**

以前整合一个 MyBatis 需要几十行 XML 配置，现在 Spring Boot 自动配置，开箱即用。

### 1.4 什么场景该用 Spring / Spring Boot

| 场景 | 推荐方案 |
|------|----------|
| 新项目，Web 后端服务 | Spring Boot（首选） |
| 微服务架构 | Spring Boot + Spring Cloud |
| 已有 Spring 老项目维护 | 继续用 Spring，逐步迁移到 Boot |
| 简单脚本/工具 | 不需要 Spring，杀鸡别用牛刀 |
| 极致性能（游戏服务器等） | 考虑 Netty 等更轻量方案 |
| 响应式/高并发场景 | Spring WebFlux |

### 1.5 Spring vs Spring Boot vs Spring Cloud

| 维度 | Spring Framework | Spring Boot | Spring Cloud |
|------|-----------------|-------------|--------------|
| 定位 | 基础框架，提供 IoC、AOP 等核心能力 | 快速构建独立应用的脚手架 | 分布式/微服务解决方案 |
| 配置方式 | 大量 XML 或 Java Config | 自动配置，约定优于配置 | 基于 Spring Boot 扩展 |
| 内嵌服务器 | 无，需要外部 Tomcat | 内嵌 Tomcat/Jetty/Undertow | 依赖 Spring Boot |
| 适用场景 | 任何 Java 项目 | 独立微服务、Web 应用 | 微服务架构（注册、网关、配置中心） |
| 上手难度 | 较高 | 低 | 中等 |
| 关系 | 地基 | 地基 + 精装修 | 地基 + 精装修 + 小区物业 |

> 一句话总结：Spring 是地基，Spring Boot 是精装修的房子，Spring Cloud 是整个小区的物业管理系统。

---

## 二、项目搭建：从零到跑通

### 2.1 Spring Initializr 使用指南

打开 [https://start.spring.io](https://start.spring.io)，按以下方式选择：

```
Project:        Maven（国内主流，Gradle 也可以）
Language:       Java
Spring Boot:    3.2.x（选最新稳定版，不要选 SNAPSHOT）
Packaging:      Jar（内嵌 Tomcat，部署方便）
Java:           17（Spring Boot 3.x 最低要求就是 Java 17）

Group:          com.example
Artifact:       order-system
Name:           order-system
Description:    订单管理系统
Package name:   com.example.ordersystem
```

**选择依赖（勾选以下这些）：**

| 依赖名称 | 作用 | 为什么选它 |
|----------|------|-----------|
| Spring Web | 构建 RESTful API | 后端项目的基础，包含 Tomcat |
| Spring Data JPA | ORM 框架 | 操作数据库不用写 SQL |
| MySQL Driver | MySQL 数据库驱动 | 连接 MySQL 必备 |
| Spring Boot DevTools | 热部署 | 改代码自动重启，开发效率翻倍 |
| Lombok | 减少样板代码 | 自动生成 getter/setter/构造器 |
| Spring Validation | 参数校验 | 校验请求参数的合法性 |

点击 **Generate** 下载压缩包，解压后用 IDEA 打开。

### 2.2 项目目录结构详解

```
order-system/
├── src/
│   ├── main/
│   │   ├── java/com/example/ordersystem/
│   │   │   ├── OrderSystemApplication.java  # 启动类，程序入口
│   │   │   ├── config/                      # 配置类（数据源、Redis、拦截器等）
│   │   │   │   ├── WebMvcConfig.java
│   │   │   │   └── RedisConfig.java
│   │   │   ├── controller/                  # 控制器层，接收 HTTP 请求
│   │   │   │   └── OrderController.java
│   │   │   ├── service/                     # 服务层，处理业务逻辑
│   │   │   │   ├── OrderService.java        # 接口
│   │   │   │   └── impl/
│   │   │   │       └── OrderServiceImpl.java # 实现类
│   │   │   ├── repository/                  # 数据访问层（JPA 用 repository）
│   │   │   │   └── OrderRepository.java
│   │   │   ├── entity/                      # 实体类，映射数据库表
│   │   │   │   └── Order.java
│   │   │   ├── dto/                         # 数据传输对象（接收前端请求）
│   │   │   │   ├── OrderCreateDTO.java
│   │   │   │   └── OrderQueryDTO.java
│   │   │   ├── vo/                          # 视图对象（返回给前端的数据）
│   │   │   │   └── OrderVO.java
│   │   │   ├── common/                      # 通用工具类和常量
│   │   │   │   ├── Result.java              # 统一响应封装
│   │   │   │   ├── ResultCode.java          # 响应码枚举
│   │   │   │   └── PageResult.java          # 分页响应封装
│   │   │   ├── exception/                   # 自定义异常和全局异常处理
│   │   │   │   ├── BusinessException.java
│   │   │   │   └── GlobalExceptionHandler.java
│   │   │   ├── enums/                       # 枚举类
│   │   │   │   └── OrderStatusEnum.java
│   │   │   └── utils/                       # 工具类
│   │   │       └── DateUtils.java
│   │   └── resources/
│   │       ├── application.yml              # 主配置文件
│   │       ├── application-dev.yml          # 开发环境配置
│   │       ├── application-test.yml         # 测试环境配置
│   │       ├── application-prod.yml         # 生产环境配置
│   │       ├── logback-spring.xml           # 日志配置
│   │       └── static/                      # 静态资源（一般前后端分离不用）
│   └── test/                                # 测试代码（目录结构和 main 对应）
│       └── java/com/example/ordersystem/
│           └── OrderSystemApplicationTests.java
├── pom.xml                                  # Maven 依赖管理
├── .gitignore                               # Git 忽略文件
└── mvnw / mvnw.cmd                          # Maven Wrapper（不装 Maven 也能构建）
```

### 2.3 pom.xml 关键依赖逐行说明

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <!-- 继承 Spring Boot 父工程，统一管理所有依赖版本 -->
    <!-- 有了这个，下面的依赖都不用写版本号，Boot 帮你管 -->
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/>
    </parent>

    <!-- 项目坐标信息 -->
    <groupId>com.example</groupId>        <!-- 公司/组织域名反写 -->
    <artifactId>order-system</artifactId>  <!-- 项目名 -->
    <version>1.0.0</version>               <!-- 版本号 -->
    <name>order-system</name>              <!-- 项目显示名 -->
    <description>订单管理系统</description>

    <!-- 统一声明 Java 版本 -->
    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <!-- Spring Web：包含 Spring MVC、内嵌 Tomcat、JSON 序列化 -->
        <!-- 有了它就能写 @RestController 接口 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <!-- Spring Data JPA：ORM 框架，操作数据库用的 -->
        <!-- 底层是 Hibernate，帮你把 Java 对象映射到数据库表 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <!-- MySQL 驱动：让 Java 能连接 MySQL 数据库 -->
        <!-- runtime 表示编译时不需要，运行时才需要 -->
        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <scope>runtime</scope>
        </dependency>

        <!-- 参数校验：@NotNull、@Size 等校验注解 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Lombok：自动生成 getter/setter/toString/构造器 -->
        <!-- 开发时用，编译后就不需要了 -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- DevTools：热部署，改完代码自动重启 -->
        <!-- 只在开发时生效，打包后自动排除 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-devtools</artifactId>
            <scope>runtime</scope>
            <optional>true</optional>
        </dependency>

        <!-- 测试依赖：包含 JUnit5、Mockito、Spring Test -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <!-- Spring Boot Maven 插件：支持打可执行 jar 包 -->
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <!-- 打包时排除 Lombok，运行时不需要 -->
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### 2.4 application.yml 基础配置

```yaml
# 服务器配置
server:
  port: 8080                    # 应用端口号，默认 8080
  servlet:
    context-path: /api          # 接口统一前缀，所有接口变成 /api/xxx

# Spring 核心配置
spring:
  application:
    name: order-system          # 应用名称，注册到注册中心时会用到

  # 激活的配置文件，dev=开发环境，test=测试环境，prod=生产环境
  profiles:
    active: dev

  # 数据源配置
  datasource:
    url: jdbc:mysql://localhost:3306/order_db?useUnicode=true&characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai
    # useUnicode=true         → 支持中文
    # characterEncoding=utf-8 → 字符编码
    # useSSL=false            → 开发环境关闭 SSL
    # serverTimezone          → 时区设置，避免时间差 8 小时
    username: root
    password: 123456
    driver-class-name: com.mysql.cj.jdbc.Driver  # MySQL 8.x 的驱动类

    # HikariCP 连接池配置（Spring Boot 默认连接池，性能最好）
    hikari:
      maximum-pool-size: 20     # 最大连接数，根据 CPU 核心数调整
      minimum-idle: 5           # 最小空闲连接数
      idle-timeout: 300000      # 空闲连接超时时间（毫秒），5 分钟
      max-lifetime: 1800000     # 连接最大生命周期（毫秒），30 分钟
      connection-timeout: 30000 # 获取连接的超时时间（毫秒），30 秒

  # JPA 配置
  jpa:
    hibernate:
      ddl-auto: update          # 自动更新表结构（开发用 update，生产用 none）
      # create:     每次启动删表重建（数据全丢，绝对别在生产用）
      # create-drop: 启动建表，关闭删表
      # update:     有变化就更新表结构，不删数据
      # validate:   只校验，不改表结构
      # none:       什么都不做（生产推荐）
    show-sql: true              # 控制台打印 SQL（开发调试用）
    properties:
      hibernate:
        format_sql: true        # 格式化打印的 SQL，方便阅读
    open-in-view: false         # 关闭 OSIV，避免懒加载导致的性能问题

  # Jackson 序列化配置
  jackson:
    date-format: yyyy-MM-dd HH:mm:ss  # 日期格式化
    time-zone: Asia/Shanghai            # 时区
    default-property-inclusion: non_null # 空值字段不返回给前端
```

### 2.5 启动类 @SpringBootApplication 三合一注解拆解

```java
package com.example.ordersystem;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 应用启动类
 *
 * @SpringBootApplication 是一个复合注解，等价于以下三个注解的组合：
 *
 * 1. @SpringBootConfiguration
 *    → 本质就是 @Configuration，标记这是一个配置类
 *    → 说明启动类本身也是一个 Spring 配置类，可以定义 @Bean
 *
 * 2. @EnableAutoConfiguration
 *    → 开启自动配置，这是 Spring Boot 的灵魂
 *    → 它会根据你引入的依赖自动配置 Bean
 *    → 比如你引了 spring-boot-starter-web，它就自动配置 Tomcat 和 Spring MVC
 *    → 比如你引了 spring-boot-starter-data-jpa，它就自动配置数据源和 EntityManager
 *
 * 3. @ComponentScan
 *    → 组件扫描，默认扫描启动类所在包及其所有子包
 *    → 所以启动类要放在最外层包下（com.example.ordersystem）
 *    → 这样它下面的 controller、service、repository 包都能被扫到
 */
@SpringBootApplication
public class OrderSystemApplication {

    public static void main(String[] args) {
        // SpringApplication.run() 做了以下事情：
        // 1. 创建 ApplicationContext（IoC 容器）
        // 2. 扫描并注册所有 Bean
        // 3. 启动内嵌的 Tomcat 服务器
        // 4. 执行所有的自动配置
        SpringApplication.run(OrderSystemApplication.class, args);
    }
}
```

> ⚠️ **注意：** 启动类的包路径必须是所有业务代码包的父包。如果启动类在 `com.example.ordersystem`，那么 Controller 就应该在 `com.example.ordersystem.controller` 下，不能放在 `com.example.controller` 下，否则扫描不到。

### 2.6 第一次启动，验证项目跑通

先创建数据库：

```sql
CREATE DATABASE order_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

然后运行启动类，看到以下日志说明启动成功：

```
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/

 :: Spring Boot ::                (v3.2.5)

...
Tomcat started on port 8080 (http) with context path '/api'
Started OrderSystemApplication in 3.456 seconds
```

写一个测试接口验证：

```java
@RestController
public class HealthController {

    @GetMapping("/health")
    public String health() {
        return "OK - 订单系统运行中";
    }
}
```

浏览器访问 `http://localhost:8080/api/health`，看到返回 `OK - 订单系统运行中` 就说明项目跑通了。

---

## 三、三层架构实战（以订单模块为例）

### 3.1 整体架构图示

```
┌──────────────────────────────────────────────────┐
│                   前端 / 客户端                     │
└──────────────────────┬───────────────────────────┘
                       │ HTTP 请求
                       ▼
┌──────────────────────────────────────────────────┐
│  Controller 层（控制器）                            │
│  职责：接收请求、参数校验、调用 Service、返回响应       │
│  注解：@RestController、@RequestMapping             │
└──────────────────────┬───────────────────────────┘
                       │ 调用
                       ▼
┌──────────────────────────────────────────────────┐
│  Service 层（服务/业务逻辑）                        │
│  职责：编写核心业务逻辑、事务管理、调用多个 Repository  │
│  注解：@Service、@Transactional                    │
└──────────────────────┬───────────────────────────┘
                       │ 调用
                       ▼
┌──────────────────────────────────────────────────┐
│  Repository 层（数据访问）                          │
│  职责：操作数据库、执行 CRUD                        │
│  注解：@Repository、继承 JpaRepository             │
└──────────────────────┬───────────────────────────┘
                       │ SQL
                       ▼
┌──────────────────────────────────────────────────┐
│                   数据库 MySQL                     │
└──────────────────────────────────────────────────┘
```

**为什么要分三层？**
- Controller 不写业务逻辑，只做"接线员"→ 方便替换接口协议（HTTP 换 gRPC）
- Service 不关心数据怎么存 → 方便换数据库（MySQL 换 PostgreSQL）
- Repository 只管数据库操作 → 职责单一，方便测试

### 3.2 Entity 实体类设计

首先建表：

```sql
CREATE TABLE `t_order` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '订单ID',
    `order_no` VARCHAR(64) NOT NULL COMMENT '订单编号',
    `user_id` BIGINT NOT NULL COMMENT '用户ID',
    `product_name` VARCHAR(255) NOT NULL COMMENT '商品名称',
    `quantity` INT NOT NULL DEFAULT 1 COMMENT '购买数量',
    `unit_price` DECIMAL(10,2) NOT NULL COMMENT '单价',
    `total_amount` DECIMAL(10,2) NOT NULL COMMENT '总金额',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '订单状态：0-待支付 1-已支付 2-已发货 3-已完成 4-已取消',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除：0-未删除 1-已删除',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_no` (`order_no`),  -- 订单号唯一索引
    KEY `idx_user_id` (`user_id`),          -- 用户ID普通索引，查询用户的订单
    KEY `idx_create_time` (`create_time`)   -- 创建时间索引，按时间范围查询
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';
```

对应的 Entity 实体类：

```java
package com.example.ordersystem.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单实体类，映射数据库 t_order 表
 */
@Data                   // Lombok：自动生成 getter/setter/toString/equals/hashCode
@NoArgsConstructor      // Lombok：生成无参构造器（JPA 要求必须有）
@AllArgsConstructor     // Lombok：生成全参构造器
@Builder                // Lombok：支持链式构建对象 Order.builder().orderNo("xxx").build()
@Entity                 // JPA：标记这是一个实体类，会映射到数据库表
@Table(name = "t_order") // JPA：指定映射的表名（不指定则默认用类名）
public class Order {

    @Id                                          // JPA：标记为主键
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // 主键自增策略（对应 MySQL 的 AUTO_INCREMENT）
    private Long id;

    @Column(name = "order_no", nullable = false, unique = true, length = 64)
    // name：对应的列名
    // nullable=false：不允许为空
    // unique=true：唯一约束
    // length：字段长度（只对 ddl-auto 建表有效）
    private String orderNo;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    // precision：总位数，scale：小数位数
    private BigDecimal unitPrice;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false)
    private Integer status;       // 订单状态：0-待支付 1-已支付 2-已发货 3-已完成 4-已取消

    private String remark;

    @CreationTimestamp            // Hibernate：插入时自动设置当前时间
    @Column(name = "create_time", updatable = false)  // updatable=false：更新时不修改此字段
    private LocalDateTime createTime;

    @UpdateTimestamp              // Hibernate：每次更新时自动设置当前时间
    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @Column(nullable = false)
    private Integer deleted = 0;  // 逻辑删除标记，默认 0（未删除）
}
```

订单状态枚举：

```java
package com.example.ordersystem.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 订单状态枚举
 * 用枚举代替魔法数字，代码可读性大幅提升
 */
@Getter
@AllArgsConstructor
public enum OrderStatusEnum {

    UNPAID(0, "待支付"),
    PAID(1, "已支付"),
    SHIPPED(2, "已发货"),
    COMPLETED(3, "已完成"),
    CANCELLED(4, "已取消");

    private final Integer code;    // 状态码，存数据库
    private final String desc;     // 状态描述，给前端展示

    /**
     * 根据状态码获取枚举
     */
    public static OrderStatusEnum of(Integer code) {
        for (OrderStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("未知的订单状态码: " + code);
    }
}
```

### 3.3 Repository 层

```java
package com.example.ordersystem.repository;

import com.example.ordersystem.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 订单数据访问层
 *
 * 继承 JpaRepository<实体类, 主键类型>，自动获得以下方法：
 * - save(entity)           保存/更新
 * - findById(id)           根据 ID 查询
 * - findAll()              查询所有
 * - findAll(pageable)      分页查询
 * - deleteById(id)         根据 ID 删除
 * - count()                统计总数
 * - existsById(id)         判断是否存在
 * ... 还有很多，基本 CRUD 全覆盖
 */
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // ========== 方法名查询（Spring Data JPA 的魔法） ==========
    // 只要按规则命名方法，JPA 自动生成 SQL，不用你写

    /**
     * 根据订单号查询（自动生成 WHERE order_no = ?）
     */
    Optional<Order> findByOrderNo(String orderNo);

    /**
     * 根据用户ID查询订单列表（自动生成 WHERE user_id = ?）
     */
    List<Order> findByUserId(Long userId);

    /**
     * 根据用户ID和状态查询（自动生成 WHERE user_id = ? AND status = ?）
     */
    List<Order> findByUserIdAndStatus(Long userId, Integer status);

    /**
     * 根据用户ID查询，按创建时间倒序排列
     * 自动生成 WHERE user_id = ? ORDER BY create_time DESC
     */
    List<Order> findByUserIdOrderByCreateTimeDesc(Long userId);

    /**
     * 根据用户ID分页查询
     * Pageable 参数自动处理分页和排序
     */
    Page<Order> findByUserId(Long userId, Pageable pageable);

    /**
     * 查询某个时间范围内的订单
     * Between 关键字自动生成 WHERE create_time BETWEEN ? AND ?
     */
    List<Order> findByCreateTimeBetween(LocalDateTime start, LocalDateTime end);

    /**
     * 判断订单号是否已存在
     */
    boolean existsByOrderNo(String orderNo);

    // ========== 自定义 JPQL 查询 ==========
    // 当方法名查询太复杂时，用 @Query 写 JPQL（面向对象的 SQL）

    /**
     * 统计某用户某状态的订单数量
     * JPQL 用的是实体类名和属性名，不是表名和列名
     */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.userId = :userId AND o.status = :status AND o.deleted = 0")
    long countByUserIdAndStatus(@Param("userId") Long userId, @Param("status") Integer status);

    // ========== 自定义原生 SQL 查询 ==========
    // 复杂查询实在用 JPQL 搞不定时，用原生 SQL

    /**
     * 原生 SQL 查询：统计每个状态的订单数量
     * nativeQuery = true 表示这是原生 SQL
     */
    @Query(value = "SELECT status, COUNT(*) as cnt FROM t_order WHERE deleted = 0 GROUP BY status",
           nativeQuery = true)
    List<Object[]> countGroupByStatus();

    // ========== 更新操作 ==========

    /**
     * 更新订单状态
     * @Modifying 标记这是更新/删除操作（不是查询）
     * 需要配合 @Transactional 使用
     */
    @Modifying
    @Query("UPDATE Order o SET o.status = :status, o.updateTime = CURRENT_TIMESTAMP WHERE o.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") Integer status);

    /**
     * 逻辑删除（不是真的删，只是标记 deleted = 1）
     */
    @Modifying
    @Query("UPDATE Order o SET o.deleted = 1, o.updateTime = CURRENT_TIMESTAMP WHERE o.id = :id")
    int softDelete(@Param("id") Long id);
}
```

> ⚠️ **方法名查询的命名规则速查表：**
> | 关键字 | 示例 | 生成的 SQL 片段 |
> |--------|------|----------------|
> | And | findByNameAndAge | WHERE name=? AND age=? |
> | Or | findByNameOrAge | WHERE name=? OR age=? |
> | Between | findByAgeBetween | WHERE age BETWEEN ? AND ? |
> | LessThan | findByAgeLessThan | WHERE age < ? |
> | GreaterThan | findByAgeGreaterThan | WHERE age > ? |
> | Like | findByNameLike | WHERE name LIKE ? |
> | Containing | findByNameContaining | WHERE name LIKE %?% |
> | OrderBy | findByNameOrderByAgeDesc | WHERE name=? ORDER BY age DESC |
> | Not | findByNameNot | WHERE name <> ? |
> | In | findByAgeIn | WHERE age IN (?, ?, ...) |
> | IsNull | findByNameIsNull | WHERE name IS NULL |

### 3.4 Service 层

先定义接口：

```java
package com.example.ordersystem.service;

import com.example.ordersystem.dto.OrderCreateDTO;
import com.example.ordersystem.dto.OrderQueryDTO;
import com.example.ordersystem.vo.OrderVO;
import org.springframework.data.domain.Page;

/**
 * 订单服务接口
 *
 * 为什么要定义接口？
 * 1. 面向接口编程，方便替换实现（比如从 JPA 换到 MyBatis）
 * 2. 方便写单元测试（可以 mock 接口）
 * 3. 接口是契约，让团队协作更清晰
 */
public interface OrderService {

    /**
     * 创建订单
     * @param dto 订单创建参数
     * @return 订单视图对象
     */
    OrderVO createOrder(OrderCreateDTO dto);

    /**
     * 根据订单ID查询
     * @param id 订单ID
     * @return 订单视图对象
     */
    OrderVO getOrderById(Long id);

    /**
     * 根据订单号查询
     * @param orderNo 订单编号
     * @return 订单视图对象
     */
    OrderVO getOrderByOrderNo(String orderNo);

    /**
     * 分页查询订单
     * @param queryDTO 查询条件
     * @return 分页结果
     */
    Page<OrderVO> queryOrders(OrderQueryDTO queryDTO);

    /**
     * 更新订单状态
     * @param id 订单ID
     * @param status 新状态
     */
    void updateOrderStatus(Long id, Integer status);

    /**
     * 取消订单
     * @param id 订单ID
     */
    void cancelOrder(Long id);

    /**
     * 删除订单（逻辑删除）
     * @param id 订单ID
     */
    void deleteOrder(Long id);
}
```

然后是实现类：

```java
package com.example.ordersystem.service.impl;

import com.example.ordersystem.dto.OrderCreateDTO;
import com.example.ordersystem.dto.OrderQueryDTO;
import com.example.ordersystem.entity.Order;
import com.example.ordersystem.enums.OrderStatusEnum;
import com.example.ordersystem.exception.BusinessException;
import com.example.ordersystem.repository.OrderRepository;
import com.example.ordersystem.service.OrderService;
import com.example.ordersystem.vo.OrderVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * 订单服务实现类
 */
@Slf4j                    // Lombok：自动生成 log 对象，可以直接用 log.info()
@Service                  // 标记为 Spring 的 Service Bean，会被自动扫描注册到容器中
@RequiredArgsConstructor  // Lombok：为所有 final 字段生成构造器（实现构造器注入）
public class OrderServiceImpl implements OrderService {

    // 使用构造器注入（Spring 官方推荐的注入方式）
    // 为什么不用 @Autowired？构造器注入保证依赖不为 null，且对象不可变
    private final OrderRepository orderRepository;

    /**
     * 创建订单
     *
     * @Transactional 说明：
     * - 标在方法上，整个方法在一个事务里执行
     * - 方法正常结束 → 自动提交事务
     * - 方法抛出 RuntimeException → 自动回滚事务
     * - rollbackFor = Exception.class → 所有异常都回滚（默认只回滚 RuntimeException）
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderVO createOrder(OrderCreateDTO dto) {
        log.info("开始创建订单, userId={}, productName={}", dto.getUserId(), dto.getProductName());

        // 1. 生成唯一订单号
        String orderNo = generateOrderNo();

        // 2. 计算总金额 = 单价 x 数量
        BigDecimal totalAmount = dto.getUnitPrice().multiply(BigDecimal.valueOf(dto.getQuantity()));

        // 3. 构建订单实体（使用 Builder 模式，清晰易读）
        Order order = Order.builder()
                .orderNo(orderNo)
                .userId(dto.getUserId())
                .productName(dto.getProductName())
                .quantity(dto.getQuantity())
                .unitPrice(dto.getUnitPrice())
                .totalAmount(totalAmount)
                .status(OrderStatusEnum.UNPAID.getCode())  // 新订单默认待支付
                .remark(dto.getRemark())
                .deleted(0)
                .build();

        // 4. 保存到数据库（save 方法会返回带有自增 ID 的实体）
        Order savedOrder = orderRepository.save(order);
        log.info("订单创建成功, orderNo={}, id={}", orderNo, savedOrder.getId());

        // 5. Entity 转 VO 返回给前端
        return convertToVO(savedOrder);
    }

    @Override
    public OrderVO getOrderById(Long id) {
        // findById 返回 Optional，避免空指针
        // orElseThrow：找不到就抛异常
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new BusinessException("订单不存在, id=" + id));
        return convertToVO(order);
    }

    @Override
    public OrderVO getOrderByOrderNo(String orderNo) {
        Order order = orderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> new BusinessException("订单不存在, orderNo=" + orderNo));
        return convertToVO(order);
    }

    @Override
    public Page<OrderVO> queryOrders(OrderQueryDTO queryDTO) {
        // 构建分页参数
        // PageRequest.of(页码从0开始, 每页条数, 排序规则)
        Pageable pageable = PageRequest.of(
                queryDTO.getPageNum() - 1,     // 前端传的页码从 1 开始，JPA 从 0 开始
                queryDTO.getPageSize(),
                Sort.by(Sort.Direction.DESC, "createTime")  // 按创建时间倒序
        );

        // 执行分页查询
        Page<Order> orderPage;
        if (queryDTO.getUserId() != null) {
            orderPage = orderRepository.findByUserId(queryDTO.getUserId(), pageable);
        } else {
            orderPage = orderRepository.findAll(pageable);
        }

        // Page 对象的 map 方法可以方便地转换元素类型
        return orderPage.map(this::convertToVO);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateOrderStatus(Long id, Integer status) {
        // 先查出来看看存不存在
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new BusinessException("订单不存在"));

        // 校验状态流转是否合法（不能从已完成变成待支付）
        validateStatusTransition(order.getStatus(), status);

        int rows = orderRepository.updateStatus(id, status);
        if (rows == 0) {
            throw new BusinessException("更新订单状态失败");
        }
        log.info("订单状态更新成功, id={}, {} -> {}", id,
                OrderStatusEnum.of(order.getStatus()).getDesc(),
                OrderStatusEnum.of(status).getDesc());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelOrder(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new BusinessException("订单不存在"));

        // 只有待支付的订单才能取消
        if (!OrderStatusEnum.UNPAID.getCode().equals(order.getStatus())) {
            throw new BusinessException("只有待支付的订单才能取消");
        }

        orderRepository.updateStatus(id, OrderStatusEnum.CANCELLED.getCode());
        log.info("订单已取消, id={}, orderNo={}", id, order.getOrderNo());

        // 如果有库存服务，这里还需要释放库存
        // inventoryService.releaseStock(order.getProductId(), order.getQuantity());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteOrder(Long id) {
        // 逻辑删除，不是物理删除
        int rows = orderRepository.softDelete(id);
        if (rows == 0) {
            throw new BusinessException("删除订单失败，订单不存在");
        }
        log.info("订单已删除（逻辑删除）, id={}", id);
    }

    // =================== 私有方法 ===================

    /**
     * 生成订单号：年月日时分秒 + 4位随机数
     * 示例：ORD20240315143052-a1b2
     */
    private String generateOrderNo() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String random = UUID.randomUUID().toString().substring(0, 4);
        return "ORD" + timestamp + "-" + random;
    }

    /**
     * Entity 转 VO
     */
    private OrderVO convertToVO(Order order) {
        OrderVO vo = new OrderVO();
        // BeanUtils.copyProperties：把源对象的属性值复制到目标对象（属性名和类型要一致）
        BeanUtils.copyProperties(order, vo);
        // 状态码转成中文描述
        vo.setStatusDesc(OrderStatusEnum.of(order.getStatus()).getDesc());
        return vo;
    }

    /**
     * 校验订单状态流转是否合法
     * 合法流转：待支付→已支付→已发货→已完成
     *          待支付→已取消
     */
    private void validateStatusTransition(Integer currentStatus, Integer newStatus) {
        // 简单的状态机校验，实际项目可以用状态模式
        boolean valid = switch (currentStatus) {
            case 0 -> newStatus == 1 || newStatus == 4;  // 待支付 → 已支付/已取消
            case 1 -> newStatus == 2;                     // 已支付 → 已发货
            case 2 -> newStatus == 3;                     // 已发货 → 已完成
            default -> false;                             // 已完成和已取消不能再变
        };
        if (!valid) {
            throw new BusinessException(
                    String.format("非法的状态流转: %s -> %s",
                            OrderStatusEnum.of(currentStatus).getDesc(),
                            OrderStatusEnum.of(newStatus).getDesc()));
        }
    }
}
```

### 3.5 Controller 层

```java
package com.example.ordersystem.controller;

import com.example.ordersystem.common.Result;
import com.example.ordersystem.dto.OrderCreateDTO;
import com.example.ordersystem.dto.OrderQueryDTO;
import com.example.ordersystem.service.OrderService;
import com.example.ordersystem.vo.OrderVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

/**
 * 订单控制器
 *
 * @RestController = @Controller + @ResponseBody
 *   - @Controller：标记为控制器 Bean
 *   - @ResponseBody：方法返回值直接作为 HTTP 响应体（自动转 JSON）
 *
 * @RequestMapping("/orders")：该 Controller 下所有接口的公共前缀
 * 最终接口路径 = context-path + Controller路径 + 方法路径
 * 例如：/api/orders/123
 */
@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    /**
     * 创建订单
     * POST /api/orders
     *
     * @RequestBody：从请求体中读取 JSON 并反序列化为 Java 对象
     * @Valid：触发 DTO 上的参数校验注解（@NotNull、@Size 等）
     */
    @PostMapping
    public Result<OrderVO> createOrder(@RequestBody @Valid OrderCreateDTO dto) {
        OrderVO orderVO = orderService.createOrder(dto);
        return Result.success(orderVO);
    }

    /**
     * 根据ID查询订单
     * GET /api/orders/123
     *
     * @PathVariable：从 URL 路径中提取参数
     * {id} 对应方法参数 id
     */
    @GetMapping("/{id}")
    public Result<OrderVO> getById(@PathVariable("id") Long id) {
        OrderVO orderVO = orderService.getOrderById(id);
        return Result.success(orderVO);
    }

    /**
     * 根据订单号查询
     * GET /api/orders/no/ORD20240315143052-a1b2
     */
    @GetMapping("/no/{orderNo}")
    public Result<OrderVO> getByOrderNo(@PathVariable("orderNo") String orderNo) {
        OrderVO orderVO = orderService.getOrderByOrderNo(orderNo);
        return Result.success(orderVO);
    }

    /**
     * 分页查询订单
     * GET /api/orders?pageNum=1&pageSize=10&userId=100
     *
     * 当参数是简单类型（String、Integer 等）且参数名和字段名一致时，
     * Spring 会自动将查询参数绑定到 DTO 对象，不需要 @RequestParam
     */
    @GetMapping
    public Result<Page<OrderVO>> queryOrders(OrderQueryDTO queryDTO) {
        Page<OrderVO> page = orderService.queryOrders(queryDTO);
        return Result.success(page);
    }

    /**
     * 更新订单状态
     * PUT /api/orders/123/status?status=1
     *
     * @RequestParam：从查询参数中获取值
     */
    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(
            @PathVariable("id") Long id,
            @RequestParam("status") Integer status) {
        orderService.updateOrderStatus(id, status);
        return Result.success();
    }

    /**
     * 取消订单
     * PUT /api/orders/123/cancel
     */
    @PutMapping("/{id}/cancel")
    public Result<Void> cancelOrder(@PathVariable("id") Long id) {
        orderService.cancelOrder(id);
        return Result.success();
    }

    /**
     * 删除订单（逻辑删除）
     * DELETE /api/orders/123
     */
    @DeleteMapping("/{id}")
    public Result<Void> deleteOrder(@PathVariable("id") Long id) {
        orderService.deleteOrder(id);
        return Result.success();
    }
}
```

### 3.6 DTO/VO 的使用

**为什么不直接暴露 Entity？**

| 问题 | 说明 |
|------|------|
| 安全风险 | Entity 包含 deleted、密码等敏感字段，直接返回前端不安全 |
| 过度暴露 | 前端不需要的字段也返回了，浪费带宽 |
| 耦合严重 | 数据库表结构变了，接口返回也得跟着变 |
| 循环引用 | Entity 之间有关联关系时，序列化会死循环 |

**DTO（Data Transfer Object）：接收前端请求参数**

```java
package com.example.ordersystem.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 创建订单请求 DTO
 * 只包含前端需要传的字段，不包含 id、createTime 等服务端生成的字段
 */
@Data
public class OrderCreateDTO {

    @NotNull(message = "用户ID不能为空")
    private Long userId;

    @NotBlank(message = "商品名称不能为空")        // @NotBlank 用于 String，不为 null 且不为空字符串
    @Size(max = 255, message = "商品名称最长255个字符")
    private String productName;

    @NotNull(message = "购买数量不能为空")
    @Min(value = 1, message = "购买数量至少为1")     // 最小值限制
    @Max(value = 9999, message = "购买数量最多9999")  // 最大值限制
    private Integer quantity;

    @NotNull(message = "单价不能为空")
    @DecimalMin(value = "0.01", message = "单价不能低于0.01") // BigDecimal 用这个
    private BigDecimal unitPrice;

    @Size(max = 500, message = "备注最长500个字符")
    private String remark;
}
```

```java
package com.example.ordersystem.dto;

import lombok.Data;

/**
 * 订单查询 DTO
 */
@Data
public class OrderQueryDTO {

    private Long userId;            // 用户ID（可选）
    private Integer status;         // 订单状态（可选）

    private Integer pageNum = 1;    // 页码，默认第 1 页
    private Integer pageSize = 10;  // 每页条数，默认 10 条
}
```

**VO（View Object）：返回给前端的数据**

```java
package com.example.ordersystem.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单视图对象
 * 只返回前端需要展示的字段，不返回 deleted 等内部字段
 */
@Data
public class OrderVO {

    private Long id;
    private String orderNo;
    private Long userId;
    private String productName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalAmount;
    private Integer status;
    private String statusDesc;        // 状态中文描述，Entity 里没有这个字段
    private String remark;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
```

### 3.7 统一响应封装

```java
package com.example.ordersystem.common;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

/**
 * 统一响应封装
 * 所有接口都返回这个格式，前端统一处理
 *
 * 成功示例：{"code": 200, "message": "success", "data": {...}}
 * 失败示例：{"code": 500, "message": "订单不存在", "data": null}
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Result<T> {

    private Integer code;    // 状态码：200=成功，其他=失败
    private String message;  // 提示消息
    private T data;          // 响应数据（泛型，什么类型都能放）

    /**
     * 成功（带数据）
     */
    public static <T> Result<T> success(T data) {
        return new Result<>(200, "success", data);
    }

    /**
     * 成功（不带数据，用于删除、更新等没有返回值的操作）
     */
    public static <T> Result<T> success() {
        return new Result<>(200, "success", null);
    }

    /**
     * 失败
     */
    public static <T> Result<T> error(String message) {
        return new Result<>(500, message, null);
    }

    /**
     * 失败（自定义状态码）
     */
    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null);
    }
}
```

---

## 四、配置体系

### 4.1 application.yml vs application.properties

```properties
# application.properties 格式：扁平的 key=value
spring.datasource.url=jdbc:mysql://localhost:3306/order_db
spring.datasource.username=root
spring.datasource.password=123456
spring.jpa.hibernate.ddl-auto=update
```

```yaml
# application.yml 格式：层级结构，更直观
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/order_db
    username: root
    password: 123456
  jpa:
    hibernate:
      ddl-auto: update
```

**推荐使用 yml：**
- 层级关系一目了然，不用看一堆重复前缀
- 支持列表、Map 等复杂数据结构
- 可读性更好

> ⚠️ **yml 格式注意：** 冒号后面必须有空格！`key: value` 是对的，`key:value` 会报错。缩进只能用空格，不能用 Tab。

### 4.2 多环境配置

企业项目至少有三套环境：开发（dev）、测试（test）、生产（prod）。

**application.yml（主配置文件，放通用配置）：**

```yaml
spring:
  profiles:
    active: dev   # 默认激活 dev 环境

# 所有环境通用的配置放这里
server:
  servlet:
    context-path: /api
```

**application-dev.yml（开发环境）：**

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/order_db_dev
    username: root
    password: 123456
  jpa:
    show-sql: true           # 开发环境打印 SQL
    hibernate:
      ddl-auto: update       # 开发环境自动更新表结构

logging:
  level:
    com.example.ordersystem: debug   # 开发环境打 debug 日志
```

**application-test.yml（测试环境）：**

```yaml
server:
  port: 8081

spring:
  datasource:
    url: jdbc:mysql://test-db-server:3306/order_db_test
    username: order_test
    password: test_password_xxx
  jpa:
    show-sql: false
    hibernate:
      ddl-auto: validate     # 测试环境只校验不改表

logging:
  level:
    com.example.ordersystem: info
```

**application-prod.yml（生产环境）：**

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://prod-db-cluster:3306/order_db_prod
    username: order_prod
    password: ${DB_PASSWORD}   # 生产环境密码从环境变量读取，不写在配置文件里！
  jpa:
    show-sql: false
    hibernate:
      ddl-auto: none          # 生产环境绝对不能让 Hibernate 动表结构！

logging:
  level:
    com.example.ordersystem: warn
```

**切换环境的方式：**

```bash
# 方式一：在 application.yml 中设置（开发时用）
spring.profiles.active=dev

# 方式二：启动时通过命令行参数指定（部署时用）
java -jar order-system.jar --spring.profiles.active=prod

# 方式三：通过环境变量（Docker/K8s 中常用）
export SPRING_PROFILES_ACTIVE=prod
java -jar order-system.jar

# 方式四：JVM 参数
java -Dspring.profiles.active=prod -jar order-system.jar
```

### 4.3 配置优先级完整排序

Spring Boot 的配置优先级（从高到低），高优先级覆盖低优先级：

```
1. 命令行参数                     --server.port=9090
2. SPRING_APPLICATION_JSON        JSON格式的环境变量
3. ServletConfig 初始化参数
4. ServletContext 初始化参数
5. JNDI 属性                      java:comp/env
6. Java 系统属性                  -Dserver.port=9090
7. 操作系统环境变量               export SERVER_PORT=9090
8. RandomValuePropertySource      random.* 配置
9. jar 包外的 application-{profile}.yml
10. jar 包内的 application-{profile}.yml
11. jar 包外的 application.yml
12. jar 包内的 application.yml
13. @Configuration 类上的 @PropertySource
14. 默认属性                       SpringApplication.setDefaultProperties()
```

> ⚠️ **实战技巧：** 命令行参数优先级最高，所以部署时可以通过命令行参数覆盖任何配置，不用改配置文件。比如临时改端口：`java -jar app.jar --server.port=9999`

### 4.4 @Value vs @ConfigurationProperties

**方式一：@Value（适合读取少量配置）**

```java
@Service
public class SmsService {

    // @Value 从配置文件中读取值，${} 是占位符
    @Value("${sms.api-key}")
    private String apiKey;

    @Value("${sms.api-secret}")
    private String apiSecret;

    // 可以设置默认值，配置文件没有这个 key 时用默认值
    @Value("${sms.timeout:5000}")
    private Integer timeout;    // 默认 5000 毫秒

    // 可以注入 SpEL 表达式
    @Value("#{${sms.timeout:5000} * 2}")
    private Integer doubleTimeout;  // 默认值的两倍
}
```

```yaml
# application.yml
sms:
  api-key: your-api-key
  api-secret: your-api-secret
  timeout: 3000
```

**方式二：@ConfigurationProperties（适合读取一组配置，企业级推荐）**

```java
package com.example.ordersystem.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 短信服务配置属性类
 *
 * @ConfigurationProperties(prefix = "sms")
 * 会自动将 application.yml 中 sms.xxx 的值绑定到类的属性上
 * 属性名对应规则：api-key → apiKey（自动转驼峰）
 */
@Data
@Component                              // 注册为 Spring Bean
@ConfigurationProperties(prefix = "sms") // 绑定配置前缀
public class SmsProperties {

    private String apiKey;              // 对应 sms.api-key
    private String apiSecret;           // 对应 sms.api-secret
    private Integer timeout = 5000;     // 默认值直接写在字段上
    private Integer retryTimes = 3;     // 重试次数
    private List<String> whiteList;     // 白名单手机号列表
}
```

```yaml
sms:
  api-key: your-api-key
  api-secret: your-api-secret
  timeout: 3000
  retry-times: 3
  white-list:
    - 13800138000
    - 13900139000
```

使用时注入就行：

```java
@Service
@RequiredArgsConstructor
public class SmsService {

    private final SmsProperties smsProperties; // 直接注入配置类

    public void sendSms(String phone, String content) {
        // 直接用属性
        if (smsProperties.getWhiteList().contains(phone)) {
            log.info("白名单用户，跳过短信验证");
            return;
        }
        // 使用 apiKey、timeout 等...
    }
}
```

**两种方式对比：**

| 维度 | @Value | @ConfigurationProperties |
|------|--------|-------------------------|
| 适用场景 | 读取 1-2 个配置 | 读取一组相关配置 |
| 类型安全 | 弱（字符串匹配） | 强（编译期检查） |
| 松散绑定 | 不支持 | 支持（api-key → apiKey） |
| SpEL 支持 | 支持 | 不支持 |
| 复杂类型 | 不方便（List、Map 很难写） | 直接支持 |
| IDE 提示 | 无 | 有（配合 spring-boot-configuration-processor） |
| 推荐程度 | 偶尔用用 | 企业推荐 |

### 4.5 自定义配置类的企业级写法

完整的企业级写法，加上参数校验：

```java
package com.example.ordersystem.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 订单业务配置
 * @Validated 开启配置属性校验，启动时就能发现配置错误
 */
@Data
@Validated                                    // 开启校验
@ConfigurationProperties(prefix = "order")
public class OrderProperties {

    @NotBlank(message = "订单号前缀不能为空")
    private String noPrefix = "ORD";           // 订单号前缀

    @Min(value = 1, message = "订单过期时间至少1分钟")
    @Max(value = 1440, message = "订单过期时间最多1440分钟")
    private Integer expireMinutes = 30;        // 未支付订单过期时间（分钟）

    @Min(1)
    @Max(100)
    private Integer maxQueryPageSize = 50;     // 最大分页查询条数
}
```

在启动类或配置类上开启：

```java
@SpringBootApplication
@EnableConfigurationProperties(OrderProperties.class)  // 注册配置属性类
public class OrderSystemApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderSystemApplication.class, args);
    }
}
```

```yaml
# application.yml
order:
  no-prefix: ORD
  expire-minutes: 30
  max-query-page-size: 50
```

### 4.6 敏感配置的处理方式

**生产环境的数据库密码、API Key 等敏感信息绝对不能明文写在配置文件里！**

**方式一：环境变量（最常用）**

```yaml
spring:
  datasource:
    password: ${DB_PASSWORD}    # 从环境变量 DB_PASSWORD 读取
```

```bash
# 部署时设置环境变量
export DB_PASSWORD=超级复杂的密码
java -jar order-system.jar
```

**方式二：Jasypt 加密配置**

引入依赖：

```xml
<dependency>
    <groupId>com.github.ulisesbocchio</groupId>
    <artifactId>jasypt-spring-boot-starter</artifactId>
    <version>3.0.5</version>
</dependency>
```

加密配置值：

```yaml
jasypt:
  encryptor:
    password: ${JASYPT_ENCRYPTOR_PASSWORD}  # 加密密钥从环境变量读取
    algorithm: PBEWithMD5AndDES

spring:
  datasource:
    # ENC() 包裹的值会自动解密
    password: ENC(G8+MbMIlTJ0yz81oM5P1WQ==)
```

生成加密后的密文：

```bash
# 用 Jasypt 提供的工具加密
java -cp jasypt-1.9.3.jar org.jasypt.intf.cli.JasyptPBEStringEncryptionCLI \
  input="你的数据库密码" \
  password="你的加密密钥" \
  algorithm=PBEWithMD5AndDES
```

> ⚠️ **绝对禁止：** 把生产环境的密码提交到 Git 仓库！即使后来删掉了，Git 历史里还有。

---

## 五、数据库集成

### 5.1 Spring Data JPA 完整使用指南

#### 5.1.1 实体映射进阶

```java
/**
 * 实体基类：抽取公共字段，避免每个实体都写一遍
 */
@Data
@MappedSuperclass  // 标记为映射父类，不会单独建表，子类会继承其字段映射
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @CreationTimestamp
    @Column(name = "create_time", updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @Column(nullable = false)
    private Integer deleted = 0;
}

/**
 * 订单实体继承基类
 */
@Data
@Entity
@Table(name = "t_order")
@EqualsAndHashCode(callSuper = true)  // 调用父类的 equals/hashCode
public class Order extends BaseEntity {

    @Column(name = "order_no", nullable = false, unique = true, length = 64)
    private String orderNo;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    // 枚举映射：数据库存数字，Java 用枚举
    @Enumerated(EnumType.ORDINAL)  // ORDINAL=存序号，STRING=存名字
    @Column(nullable = false)
    private OrderStatusEnum status;

    // 一对多关系示例（一个订单有多个订单明细）
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    // mappedBy：关系维护方在 OrderItem 的 order 字段
    // cascade：级联操作，保存订单时自动保存明细
    // fetch：懒加载，用到明细时才查数据库
    private List<OrderItem> items;

    // ... 其他字段
}
```

#### 5.1.2 分页与排序

```java
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;

    /**
     * 分页查询示例
     */
    public Page<Order> queryWithPage(int pageNum, int pageSize) {
        // 创建分页请求：页码（从0开始）、每页条数、排序规则
        Pageable pageable = PageRequest.of(
            pageNum - 1,                            // JPA 页码从 0 开始
            pageSize,
            Sort.by(
                Sort.Order.desc("createTime"),      // 先按创建时间倒序
                Sort.Order.asc("id")                // 再按 ID 正序
            )
        );

        Page<Order> page = orderRepository.findAll(pageable);

        // Page 对象包含的信息：
        // page.getContent()       → 当前页的数据列表
        // page.getTotalElements() → 总记录数
        // page.getTotalPages()    → 总页数
        // page.getNumber()        → 当前页码（从0开始）
        // page.getSize()          → 每页条数
        // page.hasNext()          → 是否有下一页
        // page.hasPrevious()      → 是否有上一页

        return page;
    }
}
```

#### 5.1.3 自定义 SQL（复杂查询）

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    /**
     * 复杂条件查询：多条件动态查询用 Specification
     */
    // 让 Repository 继承 JpaSpecificationExecutor 接口
    // public interface OrderRepository extends JpaRepository<Order, Long>,
    //                                          JpaSpecificationExecutor<Order>
}
```

```java
/**
 * 动态条件查询（类似 MyBatis 的动态 SQL）
 */
public Page<Order> dynamicQuery(OrderQueryDTO query) {
    Specification<Order> spec = (root, criteriaQuery, criteriaBuilder) -> {
        List<Predicate> predicates = new ArrayList<>();

        // 条件一：用户ID（如果传了的话）
        if (query.getUserId() != null) {
            predicates.add(criteriaBuilder.equal(root.get("userId"), query.getUserId()));
        }

        // 条件二：订单状态
        if (query.getStatus() != null) {
            predicates.add(criteriaBuilder.equal(root.get("status"), query.getStatus()));
        }

        // 条件三：创建时间范围
        if (query.getStartTime() != null) {
            predicates.add(criteriaBuilder.greaterThanOrEqualTo(
                    root.get("createTime"), query.getStartTime()));
        }
        if (query.getEndTime() != null) {
            predicates.add(criteriaBuilder.lessThanOrEqualTo(
                    root.get("createTime"), query.getEndTime()));
        }

        // 条件四：商品名称模糊查询
        if (StringUtils.hasText(query.getProductName())) {
            predicates.add(criteriaBuilder.like(
                    root.get("productName"), "%" + query.getProductName() + "%"));
        }

        // 固定条件：未删除的
        predicates.add(criteriaBuilder.equal(root.get("deleted"), 0));

        return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
    };

    Pageable pageable = PageRequest.of(query.getPageNum() - 1, query.getPageSize(),
            Sort.by(Sort.Direction.DESC, "createTime"));

    return orderRepository.findAll(spec, pageable);
}
```

### 5.2 MyBatis-Plus 完整使用指南

#### 5.2.1 引入依赖

```xml
<!-- 注意：使用 MyBatis-Plus 就不要再引入 spring-boot-starter-data-jpa，二者选其一 -->
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
    <version>3.5.5</version>
</dependency>
```

#### 5.2.2 配置

```yaml
# MyBatis-Plus 配置
mybatis-plus:
  # Mapper XML 文件位置
  mapper-locations: classpath:mapper/*.xml
  configuration:
    # 开启驼峰命名自动转换（user_id → userId）
    map-underscore-to-camel-case: true
    # 日志输出 SQL（开发用）
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
  global-config:
    db-config:
      # 表名前缀
      table-prefix: t_
      # 主键类型：自增
      id-type: auto
      # 逻辑删除字段配置
      logic-delete-field: deleted
      logic-delete-value: 1
      logic-not-delete-value: 0
```

#### 5.2.3 实体类

```java
package com.example.ordersystem.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("t_order")  // 对应表名
public class Order {

    @TableId(type = IdType.AUTO)    // 主键自增
    private Long id;

    private String orderNo;         // MyBatis-Plus 自动转 order_no

    private Long userId;

    private String productName;

    private Integer quantity;

    private BigDecimal unitPrice;

    private BigDecimal totalAmount;

    private Integer status;

    private String remark;

    @TableField(fill = FieldFill.INSERT)   // 插入时自动填充
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)  // 插入和更新时自动填充
    private LocalDateTime updateTime;

    @TableLogic  // 标记为逻辑删除字段
    private Integer deleted;
}
```

#### 5.2.4 自动填充处理器

```java
package com.example.ordersystem.config;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * MyBatis-Plus 自动填充处理器
 * 自动为 createTime、updateTime 赋值，不用每次手动设置
 */
@Component
public class MyMetaObjectHandler implements MetaObjectHandler {

    @Override
    public void insertFill(MetaObject metaObject) {
        // 插入时自动填充
        this.strictInsertFill(metaObject, "createTime", LocalDateTime.class, LocalDateTime.now());
        this.strictInsertFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        // 更新时自动填充
        this.strictUpdateFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
    }
}
```

#### 5.2.5 Mapper 接口

```java
package com.example.ordersystem.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.ordersystem.entity.Order;
import org.apache.ibatis.annotations.Mapper;

/**
 * 订单 Mapper
 *
 * 继承 BaseMapper<Order> 自动获得以下方法：
 * - insert(entity)                 插入
 * - deleteById(id)                 根据 ID 删除（配合 @TableLogic 自动变成逻辑删除）
 * - updateById(entity)             根据 ID 更新
 * - selectById(id)                 根据 ID 查询
 * - selectList(wrapper)            条件查询列表
 * - selectPage(page, wrapper)      分页查询
 * - selectCount(wrapper)           统计数量
 * ... 还有几十个方法
 */
@Mapper
public interface OrderMapper extends BaseMapper<Order> {

    // 如果 BaseMapper 的方法不够用，可以在这里自定义
    // 复杂 SQL 放在 resources/mapper/OrderMapper.xml 中
}
```

#### 5.2.6 条件构造器（MyBatis-Plus 的灵魂）

```java
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderMapper orderMapper;

    /**
     * 条件构造器使用示例
     */
    public List<Order> queryByCondition(OrderQueryDTO dto) {
        // LambdaQueryWrapper：类型安全的条件构造器（推荐用 Lambda 方式）
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();

        wrapper
            // eq：等于（WHERE user_id = ?）
            // 第一个参数是条件，为 true 时才加这个查询条件
            .eq(dto.getUserId() != null, Order::getUserId, dto.getUserId())

            // eq：等于（WHERE status = ?）
            .eq(dto.getStatus() != null, Order::getStatus, dto.getStatus())

            // like：模糊查询（WHERE product_name LIKE '%xxx%'）
            .like(StringUtils.hasText(dto.getProductName()),
                  Order::getProductName, dto.getProductName())

            // ge：大于等于（WHERE create_time >= ?）
            .ge(dto.getStartTime() != null, Order::getCreateTime, dto.getStartTime())

            // le：小于等于（WHERE create_time <= ?）
            .le(dto.getEndTime() != null, Order::getCreateTime, dto.getEndTime())

            // orderByDesc：倒序排列
            .orderByDesc(Order::getCreateTime);

        return orderMapper.selectList(wrapper);
    }

    /**
     * 分页查询示例
     */
    public IPage<Order> queryWithPage(OrderQueryDTO dto) {
        // 创建分页对象
        Page<Order> page = new Page<>(dto.getPageNum(), dto.getPageSize());

        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(dto.getUserId() != null, Order::getUserId, dto.getUserId())
               .orderByDesc(Order::getCreateTime);

        // selectPage 返回 IPage 对象
        IPage<Order> result = orderMapper.selectPage(page, wrapper);

        // result.getRecords()   → 当前页数据
        // result.getTotal()     → 总记录数
        // result.getPages()     → 总页数
        // result.getCurrent()   → 当前页码
        // result.getSize()      → 每页条数

        return result;
    }

    /**
     * 更新操作示例
     */
    public void updateOrderStatus(Long id, Integer status) {
        // 方式一：用 UpdateWrapper
        LambdaUpdateWrapper<Order> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Order::getId, id)
               .set(Order::getStatus, status);
        orderMapper.update(null, wrapper);

        // 方式二：用实体对象更新（只更新非 null 字段）
        Order order = new Order();
        order.setId(id);
        order.setStatus(status);
        orderMapper.updateById(order);  // 只会更新 status 字段
    }
}
```

#### 5.2.7 分页插件配置

```java
package com.example.ordersystem.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 配置类
 */
@Configuration
public class MybatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();

        // 分页插件（必须配置，否则分页不生效！）
        PaginationInnerInterceptor paginationInterceptor = new PaginationInnerInterceptor(DbType.MYSQL);
        paginationInterceptor.setMaxLimit(500L);  // 单页最大 500 条，防止一次查太多
        interceptor.addInnerInterceptor(paginationInterceptor);

        return interceptor;
    }
}
```

### 5.3 JPA vs MyBatis-Plus 选型对比

| 维度 | Spring Data JPA | MyBatis-Plus |
|------|----------------|--------------|
| 学习曲线 | 较陡（需理解 JPA 规范、Hibernate） | 较平缓 |
| SQL 控制力 | 弱（复杂 SQL 不好写） | 强（完全控制 SQL） |
| 开发效率 | 简单 CRUD 极快 | 条件构造器非常方便 |
| 复杂查询 | Specification 比较啰嗦 | 条件构造器 + XML 灵活 |
| 多表关联 | @OneToMany 等注解支持 | 需要手写 XML |
| 性能优化 | 不太好优化 SQL | 完全可控 |
| 国内使用率 | 较低 | 非常高（国内首选） |
| 适合场景 | 简单增删改查、DDD 项目 | 复杂查询多、报表系统 |
| 社区 | 国际化，文档全面 | 国内社区活跃，中文文档 |

> ⚠️ **选型建议：** 国内中大型项目推荐 MyBatis-Plus，生态好、灵活、团队接受度高。小项目或者简单 CRUD 可以用 JPA，开发速度快。两个不要混着用。

### 5.4 HikariCP 连接池配置与调优

HikariCP 是 Spring Boot 默认的数据库连接池，性能最好。

```yaml
spring:
  datasource:
    hikari:
      # ===== 核心参数 =====

      # 最大连接数（核心参数！）
      # 公式：CPU核心数 * 2 + 磁盘数（一般 SSD 算 1）
      # 4核CPU → 4 * 2 + 1 = 9，实际一般设 10-20
      maximum-pool-size: 20

      # 最小空闲连接数
      # 建议和 maximum-pool-size 一样，避免频繁创建销毁连接
      minimum-idle: 10

      # ===== 超时参数 =====

      # 获取连接的超时时间（毫秒）
      # 超过这个时间拿不到连接就抛异常
      connection-timeout: 30000     # 30秒

      # 空闲连接的超时时间（毫秒）
      # 超过这个时间的空闲连接会被回收（前提是连接数 > minimumIdle）
      idle-timeout: 600000          # 10分钟

      # 连接的最大生命周期（毫秒）
      # 到期后连接会被优雅地关闭和替换
      # 要比数据库的 wait_timeout 小（MySQL 默认 8 小时 = 28800000）
      max-lifetime: 1800000         # 30分钟

      # ===== 其他参数 =====

      # 连接池名称（日志中显示，方便排查多数据源问题）
      pool-name: OrderSystemHikariPool

      # 连接测试语句
      connection-test-query: SELECT 1

      # 连接泄漏检测阈值（毫秒）
      # 连接被借出超过这个时间就报警（日志打印堆栈）
      leak-detection-threshold: 60000  # 60秒
```

> ⚠️ **常见错误：** maximum-pool-size 设太大（比如 100）反而会降低性能！因为数据库连接是重资源，连接太多数据库也扛不住。一般 10-30 足够。

### 5.5 多数据源配置

当一个项目需要连接多个数据库时（比如订单库和用户库分开）：

```yaml
# application.yml
spring:
  datasource:
    # 主数据源：订单库
    order:
      url: jdbc:mysql://localhost:3306/order_db
      username: root
      password: 123456
      driver-class-name: com.mysql.cj.jdbc.Driver
    # 从数据源：用户库
    user:
      url: jdbc:mysql://localhost:3306/user_db
      username: root
      password: 123456
      driver-class-name: com.mysql.cj.jdbc.Driver
```

```java
package com.example.ordersystem.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Configuration
public class DataSourceConfig {

    /**
     * 主数据源（订单库）
     * @Primary 标记为默认数据源，不指定时用这个
     */
    @Bean("orderDataSource")
    @Primary
    @ConfigurationProperties(prefix = "spring.datasource.order")
    public DataSource orderDataSource() {
        return new HikariDataSource();
    }

    /**
     * 从数据源（用户库）
     */
    @Bean("userDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.user")
    public DataSource userDataSource() {
        return new HikariDataSource();
    }
}
```

> ⚠️ **多数据源注意事项：** 多数据源场景下，JPA 和 MyBatis 的配置会更复杂，需要为每个数据源单独配置 EntityManagerFactory（JPA）或 SqlSessionFactory（MyBatis），并指定各自扫描的 Mapper/Repository 包路径。实际项目中建议使用 `dynamic-datasource-spring-boot-starter` 来简化配置。

---

## 六、常用组件集成

### 6.1 Redis 缓存集成

#### 6.1.1 引入依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

#### 6.1.2 配置

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password:                 # 没有密码就留空
      database: 0               # 用第 0 号库
      timeout: 5000             # 连接超时时间（毫秒）
      lettuce:                  # Spring Boot 默认用 Lettuce 客户端
        pool:
          max-active: 20        # 最大连接数
          max-idle: 10          # 最大空闲连接数
          min-idle: 5           # 最小空闲连接数
          max-wait: 3000        # 最大等待时间（毫秒）
```

#### 6.1.3 Redis 配置类

```java
package com.example.ordersystem.config;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
@EnableCaching  // 开启缓存注解支持（@Cacheable、@CacheEvict 等）
public class RedisConfig {

    /**
     * 自定义 RedisTemplate
     * 默认的 RedisTemplate<Object, Object> 用的是 JDK 序列化，存的值是乱码
     * 我们改成 JSON 序列化，存的值人能看懂
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // Key 用 String 序列化
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);

        // Value 用 JSON 序列化
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(objectMapper());
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }

    /**
     * 缓存管理器配置
     */
    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(30))        // 缓存默认过期时间 30 分钟
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new GenericJackson2JsonRedisSerializer(objectMapper())))
                .disableCachingNullValues();              // 不缓存 null 值

        return RedisCacheManager.builder(factory)
                .cacheDefaults(config)
                .build();
    }

    private ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL);
        mapper.registerModule(new JavaTimeModule()); // 支持 LocalDateTime
        return mapper;
    }
}
```

#### 6.1.4 使用方式一：RedisTemplate 手动操作

```java
@Service
@RequiredArgsConstructor
public class OrderCacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String ORDER_KEY_PREFIX = "order:";
    private static final long ORDER_CACHE_TTL = 30; // 30 分钟

    /**
     * 缓存订单
     */
    public void cacheOrder(OrderVO order) {
        String key = ORDER_KEY_PREFIX + order.getId();
        redisTemplate.opsForValue().set(key, order, ORDER_CACHE_TTL, TimeUnit.MINUTES);
    }

    /**
     * 获取缓存的订单
     */
    public OrderVO getCachedOrder(Long orderId) {
        String key = ORDER_KEY_PREFIX + orderId;
        return (OrderVO) redisTemplate.opsForValue().get(key);
    }

    /**
     * 删除缓存
     */
    public void evictOrder(Long orderId) {
        String key = ORDER_KEY_PREFIX + orderId;
        redisTemplate.delete(key);
    }

    /**
     * Redis 常用操作速查：
     *
     * opsForValue()  → String 类型操作（最常用）
     *   .set(key, value)                  设置值
     *   .set(key, value, timeout, unit)   设置值 + 过期时间
     *   .get(key)                         获取值
     *   .increment(key)                   自增 1
     *   .increment(key, delta)            自增 delta
     *
     * opsForHash()   → Hash 类型操作
     *   .put(key, hashKey, value)         设置 hash 字段
     *   .get(key, hashKey)                获取 hash 字段值
     *   .entries(key)                     获取所有字段
     *
     * opsForList()   → List 类型操作
     *   .leftPush(key, value)             左边插入
     *   .rightPop(key)                    右边弹出
     *   .range(key, start, end)           获取范围
     *
     * opsForSet()    → Set 类型操作
     *   .add(key, values)                 添加元素
     *   .members(key)                     获取所有成员
     *   .isMember(key, value)             是否包含
     *
     * opsForZSet()   → ZSet 有序集合操作
     *   .add(key, value, score)           添加带分数的元素
     *   .range(key, start, end)           按分数范围获取
     */
}
```

#### 6.1.5 使用方式二：注解缓存（更简洁）

```java
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;

    /**
     * @Cacheable：先查缓存，缓存有就直接返回，没有就执行方法并把结果缓存
     * value = "orders"     → 缓存名称（相当于 Redis 的 key 前缀）
     * key = "#id"          → 缓存的 key（SpEL 表达式，取方法参数 id 的值）
     * 最终 Redis key：orders::123
     */
    @Override
    @Cacheable(value = "orders", key = "#id")
    public OrderVO getOrderById(Long id) {
        log.info("缓存未命中，查询数据库, id={}", id);
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new BusinessException("订单不存在"));
        return convertToVO(order);
    }

    /**
     * @CacheEvict：删除缓存
     * 更新数据后要删缓存，保证数据一致性
     */
    @Override
    @CacheEvict(value = "orders", key = "#id")
    @Transactional(rollbackFor = Exception.class)
    public void updateOrderStatus(Long id, Integer status) {
        orderRepository.updateStatus(id, status);
    }

    /**
     * @CachePut：不管缓存有没有，都执行方法并更新缓存
     * 适用于更新操作
     */
    @CachePut(value = "orders", key = "#result.id")
    @Transactional(rollbackFor = Exception.class)
    public OrderVO createOrder(OrderCreateDTO dto) {
        // ... 创建订单逻辑
        return convertToVO(savedOrder);
    }

    /**
     * @CacheEvict(allEntries = true)：清空该缓存名称下的所有缓存
     * 适用于批量更新后
     */
    @CacheEvict(value = "orders", allEntries = true)
    public void batchUpdate() {
        // ... 批量更新逻辑
    }
}
```

### 6.2 参数校验（Validation）

#### 6.2.1 常用校验注解

```java
@Data
public class OrderCreateDTO {

    @NotNull(message = "用户ID不能为空")         // 不能为 null
    private Long userId;

    @NotBlank(message = "商品名称不能为空")       // 不为 null，不为 ""，不为 "  "
    @Size(min = 1, max = 255, message = "商品名称长度1-255")
    private String productName;

    @NotNull(message = "数量不能为空")
    @Min(value = 1, message = "数量至少为1")
    @Max(value = 9999, message = "数量最多9999")
    private Integer quantity;

    @NotNull(message = "单价不能为空")
    @DecimalMin(value = "0.01", message = "单价不能低于0.01")
    @DecimalMax(value = "999999.99", message = "单价不能超过999999.99")
    private BigDecimal unitPrice;

    @Size(max = 500, message = "备注最长500字符")
    private String remark;

    @Email(message = "邮箱格式不正确")           // 邮箱格式校验
    private String email;

    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")  // 正则校验
    private String phone;

    @Past(message = "出生日期必须是过去的时间")   // 必须是过去的时间
    private LocalDate birthday;

    @Future(message = "预约时间必须是未来的时间") // 必须是未来的时间
    private LocalDateTime appointmentTime;
}
```

> ⚠️ **@NotNull vs @NotEmpty vs @NotBlank：**
> - `@NotNull`：不为 null（用于 Integer、Long、对象等）
> - `@NotEmpty`：不为 null 且不为空（用于 String、集合）
> - `@NotBlank`：不为 null 且 trim 后不为空字符串（只用于 String）

#### 6.2.2 分组校验

同一个 DTO 在创建和更新时校验规则不同：创建时 id 可以为空，更新时 id 不能为空。

```java
/**
 * 校验分组接口
 */
public interface ValidationGroups {
    interface Create {}  // 创建分组
    interface Update {}  // 更新分组
}

@Data
public class OrderDTO {

    @Null(groups = ValidationGroups.Create.class, message = "创建时不需要传ID")
    @NotNull(groups = ValidationGroups.Update.class, message = "更新时ID不能为空")
    private Long id;

    @NotBlank(groups = {ValidationGroups.Create.class}, message = "商品名称不能为空")
    private String productName;
}

// Controller 中使用 @Validated 指定分组（注意是 @Validated 不是 @Valid）
@PostMapping
public Result<OrderVO> create(
        @RequestBody @Validated(ValidationGroups.Create.class) OrderDTO dto) {
    // ...
}

@PutMapping
public Result<OrderVO> update(
        @RequestBody @Validated(ValidationGroups.Update.class) OrderDTO dto) {
    // ...
}
```

#### 6.2.3 自定义校验器

```java
// 第一步：定义校验注解
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PhoneValidator.class)  // 指定校验器
public @interface Phone {
    String message() default "手机号格式不正确";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

// 第二步：实现校验逻辑
public class PhoneValidator implements ConstraintValidator<Phone, String> {

    private static final Pattern PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;  // null 的校验交给 @NotNull
        }
        return PHONE_PATTERN.matcher(value).matches();
    }
}

// 第三步：使用
@Data
public class UserDTO {
    @Phone  // 直接用自定义注解
    private String phone;
}
```

### 6.3 统一异常处理

```java
package com.example.ordersystem.exception;

import lombok.Getter;

/**
 * 业务异常
 * 区别于系统异常（NullPointerException 等），业务异常是可预见的
 * 比如：订单不存在、库存不足、余额不够
 */
@Getter
public class BusinessException extends RuntimeException {

    private final Integer code;

    public BusinessException(String message) {
        super(message);
        this.code = 500;
    }

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
    }
}
```

```java
package com.example.ordersystem.exception;

import com.example.ordersystem.common.Result;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.stream.Collectors;

/**
 * 全局异常处理器
 *
 * @RestControllerAdvice = @ControllerAdvice + @ResponseBody
 * 拦截所有 Controller 抛出的异常，统一处理并返回标准格式
 *
 * 好处：
 * 1. 不用每个 Controller 都 try-catch
 * 2. 统一错误响应格式
 * 3. 避免敏感信息泄露（比如 SQL 异常信息）
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 处理业务异常
     * 这是最常用的，业务代码中 throw new BusinessException("xxx") 就会到这里
     */
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusinessException(BusinessException e) {
        log.warn("业务异常: {}", e.getMessage());
        return Result.error(e.getCode(), e.getMessage());
    }

    /**
     * 处理参数校验异常（@RequestBody 参数校验失败）
     * 当 @Valid/@Validated 校验不通过时，会抛这个异常
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleValidationException(MethodArgumentNotValidException e) {
        // 把所有校验错误拼接成一条消息
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败: {}", message);
        return Result.error(400, message);
    }

    /**
     * 处理约束违反异常（@RequestParam、@PathVariable 参数校验失败）
     */
    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleConstraintViolation(ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining("; "));
        log.warn("约束校验失败: {}", message);
        return Result.error(400, message);
    }

    /**
     * 处理请求参数缺失
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleMissingParam(MissingServletRequestParameterException e) {
        log.warn("缺少请求参数: {}", e.getParameterName());
        return Result.error(400, "缺少必要参数: " + e.getParameterName());
    }

    /**
     * 处理请求方法不支持（比如 GET 接口用了 POST 请求）
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public Result<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return Result.error(405, "不支持的请求方法: " + e.getMethod());
    }

    /**
     * 兜底：处理所有其他未知异常
     * 这是最后的防线，避免把堆栈信息暴露给前端
     */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Void> handleException(Exception e) {
        // 未知异常要打 error 级别日志，并打印完整堆栈
        log.error("系统异常: ", e);
        // 不要把异常详情返回给前端！安全风险
        return Result.error(500, "系统繁忙，请稍后重试");
    }
}
```

### 6.4 接口文档（SpringDoc/Swagger）

#### 6.4.1 引入依赖

```xml
<!-- SpringDoc：Spring Boot 3.x 用这个（Swagger 的替代品） -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.3.0</version>
</dependency>
```

#### 6.4.2 配置

```yaml
springdoc:
  api-docs:
    path: /v3/api-docs           # API 文档 JSON 路径
  swagger-ui:
    path: /swagger-ui.html       # Swagger UI 路径
    tags-sorter: alpha            # 标签排序方式
    operations-sorter: alpha      # 操作排序方式
  default-produces-media-type: application/json
```

```java
package com.example.ordersystem.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("订单管理系统 API 文档")
                        .version("1.0.0")
                        .description("基于 Spring Boot 3.x 的订单管理系统接口文档")
                        .contact(new Contact()
                                .name("开发团队")
                                .email("dev@example.com")));
    }
}
```

#### 6.4.3 在 Controller 上添加文档注解

```java
@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
@Tag(name = "订单管理", description = "订单的增删改查接口")  // 接口分组标签
public class OrderController {

    private final OrderService orderService;

    @Operation(summary = "创建订单", description = "创建一个新的订单，返回订单详情")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "创建成功"),
        @ApiResponse(responseCode = "400", description = "参数校验失败"),
        @ApiResponse(responseCode = "500", description = "系统异常")
    })
    @PostMapping
    public Result<OrderVO> createOrder(@RequestBody @Valid OrderCreateDTO dto) {
        return Result.success(orderService.createOrder(dto));
    }

    @Operation(summary = "根据ID查询订单")
    @Parameter(name = "id", description = "订单ID", required = true, example = "1")
    @GetMapping("/{id}")
    public Result<OrderVO> getById(@PathVariable Long id) {
        return Result.success(orderService.getOrderById(id));
    }
}
```

启动项目后，访问 `http://localhost:8080/api/swagger-ui.html` 即可查看在线接口文档。

> ⚠️ **生产环境要关闭 Swagger！** 在 application-prod.yml 中添加：`springdoc.api-docs.enabled: false`

### 6.5 定时任务

#### 6.5.1 基本使用

```java
@SpringBootApplication
@EnableScheduling  // 开启定时任务支持
public class OrderSystemApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderSystemApplication.class, args);
    }
}
```

```java
package com.example.ordersystem.task;

import com.example.ordersystem.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 订单定时任务
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderScheduledTask {

    private final OrderRepository orderRepository;

    /**
     * 每 5 分钟检查一次超时未支付的订单，自动取消
     *
     * cron 表达式格式：秒 分 时 日 月 周
     * "0 0/5 * * * ?"  → 每 5 分钟执行一次（分钟数为 0, 5, 10, ...）
     *
     * 常用 cron 表达式：
     * "0 0 * * * ?"      每小时整点执行
     * "0 0 2 * * ?"      每天凌晨 2 点执行
     * "0 0 2 1 * ?"      每月 1 号凌晨 2 点执行
     * "0 0 2 ? * MON"    每周一凌晨 2 点执行
     * "0/10 * * * * ?"   每 10 秒执行一次
     */
    @Scheduled(cron = "0 0/5 * * * ?")
    public void cancelTimeoutOrders() {
        log.info("===== 开始检查超时订单 =====");
        try {
            // 查询超过 30 分钟未支付的订单
            LocalDateTime deadline = LocalDateTime.now().minusMinutes(30);
            List<Order> timeoutOrders = orderRepository
                    .findByStatusAndCreateTimeBefore(
                            OrderStatusEnum.UNPAID.getCode(), deadline);

            for (Order order : timeoutOrders) {
                orderRepository.updateStatus(order.getId(),
                        OrderStatusEnum.CANCELLED.getCode());
                log.info("超时取消订单: orderNo={}", order.getOrderNo());
            }
            log.info("===== 超时订单检查完成，取消了 {} 个订单 =====", timeoutOrders.size());
        } catch (Exception e) {
            log.error("超时订单检查异常: ", e);
        }
    }

    /**
     * fixedRate：固定频率执行，单位毫秒
     * 上一次开始后 60 秒执行下一次（不管上一次有没有执行完）
     */
    @Scheduled(fixedRate = 60000)
    public void heartbeat() {
        log.debug("系统心跳检测 - {}", LocalDateTime.now());
    }

    /**
     * fixedDelay：固定延迟执行
     * 上一次执行完成后等 30 秒再执行下一次
     */
    @Scheduled(fixedDelay = 30000)
    public void cleanTempData() {
        // 清理临时数据...
    }

    /**
     * initialDelay：首次延迟执行
     * 应用启动后等 10 秒再开始第一次执行
     */
    @Scheduled(fixedRate = 300000, initialDelay = 10000)
    public void syncData() {
        // 数据同步...
    }
}
```

> ⚠️ **注意：** `@Scheduled` 默认是单线程执行的！如果一个任务执行太久会阻塞其他任务。建议配置线程池：

```java
@Configuration
public class ScheduleConfig {

    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(5);                    // 线程池大小
        scheduler.setThreadNamePrefix("scheduled-"); // 线程名前缀（方便日志排查）
        scheduler.setWaitForTasksToCompleteOnShutdown(true);  // 优雅停机
        scheduler.setAwaitTerminationSeconds(60);
        return scheduler;
    }
}
```

---

## 七、日志与监控

### 7.1 Logback 企业级配置

Spring Boot 默认使用 Logback 作为日志框架。在 `resources/logback-spring.xml` 中配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!--
    scan：开启配置热加载，修改配置文件后自动生效
    scanPeriod：扫描间隔，60 秒检查一次配置变化
    debug：设为 false，不打印 logback 自身的调试信息
-->
<configuration scan="true" scanPeriod="60 seconds" debug="false">

    <!-- 从 application.yml 中读取应用名，用在日志文件名中 -->
    <springProperty scope="context" name="APP_NAME" source="spring.application.name"
                    defaultValue="order-system"/>

    <!-- 日志文件存放目录 -->
    <property name="LOG_PATH" value="./logs"/>

    <!-- 日志格式 -->
    <!-- %d：日期时间 -->
    <!-- %thread：线程名 -->
    <!-- %-5level：日志级别（左对齐，占5个字符） -->
    <!-- %logger{50}：类名（最长50字符，超过会缩写） -->
    <!-- %msg：日志内容 -->
    <!-- %n：换行 -->
    <property name="LOG_PATTERN"
              value="%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{50} - %msg%n"/>

    <!-- ========== 控制台输出 ========== -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
    </appender>

    <!-- ========== INFO 级别日志文件 ========== -->
    <!-- RollingFileAppender：支持日志滚动（按大小/日期切割） -->
    <appender name="INFO_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <!-- 当前日志文件路径 -->
        <file>${LOG_PATH}/${APP_NAME}-info.log</file>

        <!-- 只记录 INFO 级别 -->
        <filter class="ch.qos.logback.classic.filter.LevelFilter">
            <level>INFO</level>
            <onMatch>ACCEPT</onMatch>    <!-- 匹配 INFO 就记录 -->
            <onMismatch>DENY</onMismatch> <!-- 不匹配就丢弃 -->
        </filter>

        <!-- 滚动策略：按日期 + 大小滚动 -->
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <!-- 归档文件名格式：日志名-日期-序号.log.gz -->
            <fileNamePattern>${LOG_PATH}/archive/${APP_NAME}-info-%d{yyyy-MM-dd}-%i.log.gz</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>   <!-- 单个文件最大 100MB -->
            <maxHistory>30</maxHistory>         <!-- 最多保留 30 天 -->
            <totalSizeCap>3GB</totalSizeCap>   <!-- 总大小上限 3GB -->
        </rollingPolicy>

        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
    </appender>

    <!-- ========== ERROR 级别日志文件（单独一个文件，方便排查） ========== -->
    <appender name="ERROR_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/${APP_NAME}-error.log</file>

        <filter class="ch.qos.logback.classic.filter.LevelFilter">
            <level>ERROR</level>
            <onMatch>ACCEPT</onMatch>
            <onMismatch>DENY</onMismatch>
        </filter>

        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/archive/${APP_NAME}-error-%d{yyyy-MM-dd}-%i.log.gz</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>30</maxHistory>
            <totalSizeCap>1GB</totalSizeCap>
        </rollingPolicy>

        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
    </appender>

    <!-- ========== 异步日志（提升性能） ========== -->
    <!-- 日志写磁盘是 IO 操作，用异步写不阻塞业务线程 -->
    <appender name="ASYNC_INFO" class="ch.qos.logback.classic.AsyncAppender">
        <discardingThreshold>0</discardingThreshold>  <!-- 队列剩余 0% 时才丢弃，默认 20% -->
        <queueSize>1024</queueSize>                    <!-- 队列大小 -->
        <neverBlock>true</neverBlock>                  <!-- 队列满了不阻塞，直接丢弃 -->
        <appender-ref ref="INFO_FILE"/>                <!-- 引用上面的 INFO_FILE -->
    </appender>

    <appender name="ASYNC_ERROR" class="ch.qos.logback.classic.AsyncAppender">
        <discardingThreshold>0</discardingThreshold>
        <queueSize>256</queueSize>
        <appender-ref ref="ERROR_FILE"/>
    </appender>

    <!-- ========== 日志级别配置 ========== -->

    <!-- 项目自身的日志级别 -->
    <logger name="com.example.ordersystem" level="INFO"/>

    <!-- Spring 框架日志级别 -->
    <logger name="org.springframework" level="WARN"/>

    <!-- Hibernate SQL 日志（开发时可以设为 DEBUG 看 SQL） -->
    <logger name="org.hibernate.SQL" level="WARN"/>

    <!-- ========== 根据环境区分配置 ========== -->

    <!-- 开发环境：输出到控制台 + 文件 -->
    <springProfile name="dev">
        <root level="DEBUG">
            <appender-ref ref="CONSOLE"/>
            <appender-ref ref="ASYNC_INFO"/>
            <appender-ref ref="ASYNC_ERROR"/>
        </root>
    </springProfile>

    <!-- 测试环境：输出到文件 -->
    <springProfile name="test">
        <root level="INFO">
            <appender-ref ref="ASYNC_INFO"/>
            <appender-ref ref="ASYNC_ERROR"/>
        </root>
    </springProfile>

    <!-- 生产环境：只输出 WARN 以上到文件 -->
    <springProfile name="prod">
        <root level="WARN">
            <appender-ref ref="ASYNC_INFO"/>
            <appender-ref ref="ASYNC_ERROR"/>
        </root>
    </springProfile>

</configuration>
```

### 7.2 日志最佳实践

```java
@Slf4j  // Lombok 注解，自动生成 private static final Logger log = LoggerFactory.getLogger(XxxClass.class);
@Service
public class OrderServiceImpl implements OrderService {

    /**
     * 日志级别使用指南：
     *
     * ERROR：程序出错了，需要人工介入处理
     *   - 数据库连接失败
     *   - 调用第三方接口失败（重试也失败）
     *   - 捕获到不该出现的异常
     *
     * WARN：有风险，但程序还能跑
     *   - 参数校验失败
     *   - 调用第三方接口超时（但重试成功了）
     *   - 不推荐的用法
     *
     * INFO：重要的业务流程节点
     *   - 订单创建成功
     *   - 支付完成
     *   - 定时任务开始/结束
     *   - 应用启动/停止
     *
     * DEBUG：调试信息，生产环境不开
     *   - 方法入参出参
     *   - 中间变量值
     *   - SQL 语句
     */

    @Transactional(rollbackFor = Exception.class)
    public OrderVO createOrder(OrderCreateDTO dto) {
        // 好的日志写法：
        log.info("创建订单开始, userId={}, productName={}, quantity={}",
                dto.getUserId(), dto.getProductName(), dto.getQuantity());

        try {
            Order order = buildOrder(dto);
            orderRepository.save(order);

            log.info("创建订单成功, orderNo={}, totalAmount={}",
                    order.getOrderNo(), order.getTotalAmount());
            return convertToVO(order);

        } catch (Exception e) {
            // ERROR 日志必须打印完整堆栈
            log.error("创建订单失败, userId={}, error: ", dto.getUserId(), e);
            throw e;
        }
    }

    /**
     * 日志反面教材（不要这样写）：
     *
     * log.info("开始处理");           // 太模糊，不知道在处理什么
     * log.info("dto=" + dto);         // 用 + 拼接，不管打不打日志都会执行 toString()
     * log.info("订单: " + order.toString());  // 同上，浪费性能
     * log.error("出错了");            // 没打印异常堆栈，怎么排查？
     * log.error("出错了: " + e.getMessage()); // getMessage() 可能为 null
     *
     * 正确写法：
     * log.info("开始创建订单, userId={}", dto.getUserId());  // 用占位符，懒加载
     * log.error("创建订单失败, userId={}: ", dto.getUserId(), e); // 异常对象放最后一个参数
     */
}
```

### 7.3 Spring Boot Actuator 健康检查与监控

#### 7.3.1 引入依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

#### 7.3.2 配置

```yaml
management:
  endpoints:
    web:
      exposure:
        # 暴露哪些端点（*表示所有，生产环境不要用*）
        include: health,info,metrics,env,loggers
      base-path: /actuator        # 端点基础路径

  endpoint:
    health:
      show-details: always        # 显示健康检查详情
      # never：不显示详情
      # when-authorized：认证后显示
      # always：始终显示（开发/测试用）

  # 健康检查包含的组件
  health:
    db:
      enabled: true               # 数据库健康检查
    redis:
      enabled: true               # Redis 健康检查
    diskspace:
      enabled: true               # 磁盘空间检查
```

**常用端点：**

| 端点路径 | 说明 |
|---------|------|
| /actuator/health | 健康状态（UP/DOWN） |
| /actuator/info | 应用信息 |
| /actuator/metrics | 性能指标列表 |
| /actuator/metrics/{name} | 具体指标值（如 jvm.memory.used） |
| /actuator/env | 环境变量和配置信息 |
| /actuator/loggers | 日志级别管理（可以运行时动态修改） |
| /actuator/threaddump | 线程转储 |

> ⚠️ **安全提醒：** 生产环境必须限制 Actuator 端点的访问！不要暴露所有端点，也不要让外网访问。建议只暴露 health 端点，其他端点走内网或加认证。

### 7.4 自定义健康检查指标

```java
package com.example.ordersystem.health;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 自定义健康检查：检查订单系统的核心依赖是否正常
 *
 * 访问 /actuator/health 时会自动执行这个检查
 * 结果会在 health 响应中显示为 "orderSystem": { "status": "UP", ... }
 */
@Component
@RequiredArgsConstructor
public class OrderSystemHealthIndicator implements HealthIndicator {

    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    public Health health() {
        try {
            // 检查 Redis 连接
            String pong = redisTemplate.getConnectionFactory()
                    .getConnection().ping();

            if ("PONG".equals(pong)) {
                return Health.up()
                        .withDetail("redis", "连接正常")
                        .withDetail("message", "订单系统运行正常")
                        .build();
            } else {
                return Health.down()
                        .withDetail("redis", "连接异常")
                        .build();
            }
        } catch (Exception e) {
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }
}
```

---

## 八、常见陷阱与避坑指南

### 8.1 循环依赖

**什么是循环依赖？**

```java
@Service
public class OrderService {
    @Autowired
    private InventoryService inventoryService;  // OrderService 依赖 InventoryService
}

@Service
public class InventoryService {
    @Autowired
    private OrderService orderService;  // InventoryService 又依赖 OrderService
}
// A 依赖 B，B 又依赖 A，死循环了！
```

> ⚠️ **Spring Boot 2.6+ 默认禁止循环依赖，启动直接报错。** 不要用 `spring.main.allow-circular-references=true` 强行开启，这是掩耳盗铃。

**解决方案：**

```java
// 方案一（推荐）：重新设计，打破循环
// 提取一个公共服务，让两者都依赖公共服务而不是互相依赖
@Service
public class StockService {  // 新建一个库存操作服务
    // 只负责库存扣减/释放，不依赖 OrderService
}

@Service
public class OrderService {
    private final StockService stockService;  // 依赖新服务
}

@Service
public class InventoryService {
    private final StockService stockService;  // 依赖新服务
}

// 方案二：使用 @Lazy 延迟加载（临时方案，不推荐长期使用）
@Service
public class OrderService {
    @Lazy  // 不在启动时注入，使用时才创建代理对象
    @Autowired
    private InventoryService inventoryService;
}

// 方案三：通过事件解耦（推荐用于跨模块通信）
@Service
public class OrderService {
    @Autowired
    private ApplicationEventPublisher eventPublisher;

    public void createOrder(Order order) {
        // 创建订单后发布事件，不直接调用 InventoryService
        eventPublisher.publishEvent(new OrderCreatedEvent(order));
    }
}

@Service
public class InventoryService {
    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        // 监听订单创建事件，扣减库存
        deductStock(event.getOrder());
    }
}
```

### 8.2 事务失效的 N 种姿势

**姿势一：同类方法调用（最常见！）**

```java
@Service
public class OrderService {

    public void createOrder(OrderCreateDTO dto) {
        // 直接调用同类的另一个方法
        // 这里的 this.saveOrder() 不会走 Spring 代理，事务不生效！
        this.saveOrder(dto);
    }

    @Transactional
    public void saveOrder(OrderCreateDTO dto) {
        // 虽然加了 @Transactional，但被同类方法调用，事务注解无效
        orderRepository.save(order);
    }
}
```

**原因：** Spring 的事务是通过 AOP 代理实现的。同类方法调用走的是 `this` 而不是代理对象，所以 AOP 拦截不到。

**解决：**
```java
// 方案一：把方法放到另一个 Service 类中
@Service
public class OrderTransactionService {
    @Transactional
    public void saveOrder(OrderCreateDTO dto) {
        // 这样从外部调用就会走代理
    }
}

// 方案二：注入自身（不优雅但有效）
@Service
public class OrderService {
    @Autowired
    private OrderService self;  // 注入代理对象

    public void createOrder(OrderCreateDTO dto) {
        self.saveOrder(dto);  // 通过代理对象调用，事务生效
    }
}
```

**姿势二：异常被吞了**

```java
@Transactional
public void createOrder(OrderCreateDTO dto) {
    try {
        orderRepository.save(order);
        inventoryService.deductStock(order.getProductId(), order.getQuantity());
    } catch (Exception e) {
        // 把异常吃了！Spring 感知不到异常，不会回滚！
        log.error("出错了", e);
    }
}
```

**解决：** 要么不 catch，让异常抛出去；要么 catch 后重新 throw 或手动回滚。

```java
@Transactional
public void createOrder(OrderCreateDTO dto) {
    try {
        orderRepository.save(order);
        inventoryService.deductStock(order.getProductId(), order.getQuantity());
    } catch (Exception e) {
        log.error("创建订单失败", e);
        throw e;  // 重新抛出，让事务回滚
        // 或者手动回滚：TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
    }
}
```

**姿势三：方法不是 public**

```java
@Service
public class OrderService {

    @Transactional
    private void saveOrder(Order order) {  // private 方法，事务不生效！
        orderRepository.save(order);
    }

    @Transactional
    protected void updateOrder(Order order) {  // protected 也不行！
        orderRepository.save(order);
    }
}
```

**原因：** Spring AOP 基于代理，代理只能拦截 public 方法。

**姿势四：rollbackFor 不对**

```java
@Transactional  // 默认只回滚 RuntimeException 和 Error
public void createOrder(OrderCreateDTO dto) throws IOException {
    orderRepository.save(order);
    fileService.uploadReceipt(order);  // 抛出 IOException（checked exception）
    // IOException 不是 RuntimeException，默认不回滚！
}

// 解决：明确指定 rollbackFor
@Transactional(rollbackFor = Exception.class)  // 所有异常都回滚
public void createOrder(OrderCreateDTO dto) throws IOException {
    // ...
}
```

**姿势五：数据库引擎不支持事务**

MySQL 的 MyISAM 引擎不支持事务！必须用 InnoDB。

```sql
-- 查看表引擎
SHOW TABLE STATUS WHERE Name = 't_order';

-- 修改为 InnoDB
ALTER TABLE t_order ENGINE = InnoDB;
```

### 8.3 Bean 作用域踩坑

```java
// 单例 Bean（默认）注入原型 Bean 的坑
@Service  // 默认是单例（singleton），应用启动时创建一次，全局共享
public class OrderService {

    @Autowired
    private OrderContext orderContext;  // 期望每次请求都是新的
}

@Component
@Scope("prototype")  // 原型（prototype），每次获取都创建新实例
public class OrderContext {
    private Order currentOrder;
}

// 问题：OrderService 是单例，创建时注入了一个 OrderContext
// 之后每次用的都是同一个 OrderContext，@Scope("prototype") 没有意义了！
```

**解决方案：**

```java
// 方案一：用 @Scope + proxyMode（推荐）
@Component
@Scope(value = "prototype", proxyMode = ScopedProxyMode.TARGET_CLASS)
// proxyMode：每次访问时通过代理获取新实例
public class OrderContext {
    private Order currentOrder;
}

// 方案二：从 ApplicationContext 手动获取
@Service
public class OrderService {
    @Autowired
    private ApplicationContext applicationContext;

    public void process() {
        // 每次手动从容器获取，就是新实例
        OrderContext context = applicationContext.getBean(OrderContext.class);
    }
}

// 方案三：使用 ObjectFactory 或 ObjectProvider
@Service
public class OrderService {
    @Autowired
    private ObjectProvider<OrderContext> contextProvider;

    public void process() {
        OrderContext context = contextProvider.getObject(); // 每次获取新实例
    }
}
```

### 8.4 @Autowired 注入为 null 的排查思路

遇到注入的 Bean 为 null，按以下顺序排查：

```
1. 检查类上是否有 @Component/@Service/@Repository/@Controller 注解
   → 没有注解，Spring 不会管理这个类

2. 检查包路径是否在启动类的扫描范围内
   → 启动类在 com.example.ordersystem，但 Bean 在 com.example.other
   → 解决：移动类到正确包下，或在启动类加 @ComponentScan("com.example")

3. 检查是否用了 new 创建对象
   → OrderService service = new OrderServiceImpl(); // 这样创建的不是 Spring Bean！
   → 里面的 @Autowired 全部是 null

4. 检查是否是静态字段
   → @Autowired private static OrderDao orderDao; // 静态字段无法注入！
   → 解决：去掉 static

5. 检查是否在构造函数中使用（此时注入还没完成）
   → 构造器中 @Autowired 的字段还是 null
   → 解决：改用构造器注入，或用 @PostConstruct

6. 检查是否有多个同类型 Bean 导致冲突
   → 解决：用 @Qualifier("beanName") 指定具体要注入哪个
```

### 8.5 配置文件加载顺序导致的诡异问题

```yaml
# application.yml 中配了端口 8080
server:
  port: 8080

# application-dev.yml 中没配端口
# 期望用 8080，实际还是 8080，没问题

# 但如果 application-dev.yml 中配了
server:
  port: 8081
# 那最终是 8081，因为 profile 配置优先级 > 主配置
```

**常见坑：多个配置文件中同一个 key 被意外覆盖。**

排查方法：启动时加 `--debug` 参数，或访问 `/actuator/env` 查看每个配置项的来源。

### 8.6 跨域问题的正确解决方式

前后端分离项目一定会遇到跨域（CORS）问题。

```java
package com.example.ordersystem.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * 全局跨域配置（推荐方式）
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();

        // 允许的来源域名（生产环境要指定具体域名，不要用 *）
        config.addAllowedOriginPattern("*");

        // 允许的请求头
        config.addAllowedHeader("*");

        // 允许的请求方法
        config.addAllowedMethod("*");

        // 允许携带 Cookie
        config.setAllowCredentials(true);

        // 预检请求缓存时间（秒），减少 OPTIONS 请求
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
```

> ⚠️ **不要在 Controller 上用 @CrossOrigin 注解！** 那样要每个 Controller 都加，容易遗漏。用全局配置一劳永逸。

> ⚠️ **生产环境不要用 `*` 通配所有域名！** 要明确指定前端域名，如 `config.addAllowedOrigin("https://www.example.com")`。

### 8.7 热部署（DevTools）的坑

DevTools 虽然方便，但有几个坑要注意：

```yaml
# DevTools 配置
spring:
  devtools:
    restart:
      enabled: true              # 开启自动重启
      exclude: static/**,public/**  # 这些目录变化不触发重启
      poll-interval: 1000        # 轮询间隔（毫秒）
      quiet-period: 400          # 静默期（毫秒），连续修改时等这么久才重启
```

**坑一：类加载器问题**

DevTools 使用了两个类加载器（Base ClassLoader + Restart ClassLoader），可能导致类型转换异常：

```java
// 明明是同一个类，但因为类加载器不同，instanceof 返回 false！
// 典型场景：Redis 反序列化时报 ClassCastException
```

解决：在 `resources/META-INF/spring-devtools.properties` 中配置：
```properties
# 把需要用同一个类加载器的包加进来
restart.include.mybatis-plus=/mybatis-plus.*\.jar
```

**坑二：打包后 DevTools 自动失效**

DevTools 的 `optional=true` 确保了它不会被打进生产包，但如果你改了 Maven 配置，可能会导致生产环境也启用了热部署。

**坑三：Lombok 注解偶尔不生效**

DevTools 热重启后，Lombok 生成的代码偶尔不会更新。遇到这种情况，手动重启一下项目。

---

## 九、部署上线

### 9.1 Maven 打包方式

**方式一：打成 jar 包（推荐，内嵌 Tomcat）**

```bash
# 打包（跳过测试，加速打包）
mvn clean package -DskipTests

# 运行
java -jar target/order-system-1.0.0.jar

# 后台运行（Linux）
nohup java -jar order-system-1.0.0.jar > /dev/null 2>&1 &
```

**方式二：打成 war 包（部署到外部 Tomcat）**

```xml
<!-- pom.xml 修改打包方式 -->
<packaging>war</packaging>

<!-- 排除内嵌 Tomcat -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-tomcat</artifactId>
    <scope>provided</scope>
</dependency>
```

```java
// 启动类继承 SpringBootServletInitializer
@SpringBootApplication
public class OrderSystemApplication extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(OrderSystemApplication.class);
    }

    public static void main(String[] args) {
        SpringApplication.run(OrderSystemApplication.class, args);
    }
}
```

> ⚠️ **强烈推荐用 jar 方式部署！** war 方式是历史遗留，jar 包内嵌 Tomcat 启动快、部署简单、不用维护外部 Tomcat。

### 9.2 Dockerfile 编写（多阶段构建）

```dockerfile
# ===== 第一阶段：构建 =====
# 使用 Maven 镜像编译打包
FROM maven:3.9-eclipse-temurin-17 AS builder

# 设置工作目录
WORKDIR /app

# 先复制 pom.xml，利用 Docker 缓存层
# 只要 pom.xml 没变，依赖下载这一层就会命中缓存
COPY pom.xml .
RUN mvn dependency:go-offline -B

# 复制源代码并构建
COPY src ./src
RUN mvn clean package -DskipTests -B

# ===== 第二阶段：运行 =====
# 使用更小的 JRE 运行时镜像（比 JDK 镜像小很多）
FROM eclipse-temurin:17-jre-alpine

# 创建非 root 用户运行应用（安全最佳实践）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# 从构建阶段复制 jar 包
COPY --from=builder /app/target/order-system-1.0.0.jar app.jar

# 创建日志目录
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/actuator/health || exit 1

# JVM 参数通过环境变量传入，方便在 docker-compose 或 K8s 中调整
ENV JAVA_OPTS="-Xms512m -Xmx512m -XX:+UseG1GC"

# 启动命令
# exec 形式确保 Java 进程是 PID 1，能正确接收停机信号
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
```

**构建和运行：**

```bash
# 构建镜像
docker build -t order-system:1.0.0 .

# 运行容器
docker run -d \
    --name order-system \
    -p 8080:8080 \
    -e SPRING_PROFILES_ACTIVE=prod \
    -e DB_PASSWORD=your_password \
    -e JAVA_OPTS="-Xms1g -Xmx1g -XX:+UseG1GC" \
    -v /data/logs:/app/logs \
    order-system:1.0.0
```

**docker-compose.yml 示例（本地开发完整环境）：**

```yaml
version: '3.8'

services:
  # 应用服务
  order-system:
    build: .
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/order_db
      - SPRING_DATASOURCE_USERNAME=root
      - SPRING_DATASOURCE_PASSWORD=123456
      - SPRING_DATA_REDIS_HOST=redis
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs

  # MySQL
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: 123456
      MYSQL_DATABASE: order_db
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mysql_data:
```

### 9.3 生产环境 JVM 参数建议

```bash
java \
    # ===== 内存参数 =====
    -Xms2g                          # 初始堆大小（建议和 Xmx 一样，避免动态扩展）
    -Xmx2g                          # 最大堆大小（一般设为物理内存的 50%-70%）
    -Xmn768m                        # 年轻代大小（一般设为堆的 1/3）
    -XX:MetaspaceSize=256m          # 元空间初始大小
    -XX:MaxMetaspaceSize=256m       # 元空间最大大小

    # ===== GC 参数 =====
    -XX:+UseG1GC                    # 使用 G1 垃圾收集器（Java 17 默认）
    -XX:MaxGCPauseMillis=200        # 目标最大 GC 停顿时间（毫秒）
    -XX:G1HeapRegionSize=8m         # G1 Region 大小

    # ===== GC 日志 =====
    -Xlog:gc*:file=/app/logs/gc.log:time,tags:filecount=5,filesize=100m
    # gc*         → 记录所有 GC 信息
    # file=...    → 输出到文件
    # time,tags   → 记录时间和标签
    # filecount=5 → 最多 5 个日志文件轮转
    # filesize=100m → 单个文件最大 100MB

    # ===== OOM 参数 =====
    -XX:+HeapDumpOnOutOfMemoryError     # OOM 时自动导出堆转储
    -XX:HeapDumpPath=/app/logs/         # 堆转储文件路径

    # ===== 其他 =====
    -Dfile.encoding=UTF-8               # 文件编码
    -Duser.timezone=Asia/Shanghai       # 时区
    -Djava.security.egd=file:/dev/./urandom  # 加速随机数生成（Tomcat启动更快）

    -jar order-system-1.0.0.jar \
    --spring.profiles.active=prod
```

**内存设置参考表（假设容器分配的总内存）：**

| 容器内存 | -Xms / -Xmx | -Xmn | -XX:MetaspaceSize |
|---------|-------------|------|-------------------|
| 1GB | 512m | 192m | 128m |
| 2GB | 1g | 384m | 256m |
| 4GB | 2g-3g | 768m-1g | 256m |
| 8GB | 4g-6g | 1.5g-2g | 512m |

> ⚠️ **容器环境注意：** 不要把 -Xmx 设得和容器内存一样大！JVM 除了堆还有线程栈、元空间、直接内存等。一般 -Xmx 设为容器内存的 60%-70%。

### 9.4 优雅停机配置

```yaml
# application.yml
server:
  shutdown: graceful              # 开启优雅停机

spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s  # 优雅停机的超时时间，30秒
```

**优雅停机的过程：**

```
1. 收到关闭信号（SIGTERM）
2. 停止接收新的请求（返回 503）
3. 等待正在处理的请求完成（最多等 30 秒）
4. 关闭数据库连接池
5. 关闭线程池
6. 最终关闭 JVM
```

```java
/**
 * 如果有自定义的线程池或资源需要优雅关闭，
 * 可以实现 DisposableBean 或用 @PreDestroy 注解
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GracefulShutdownHook implements DisposableBean {

    private final ThreadPoolTaskExecutor taskExecutor;

    @Override
    public void destroy() {
        log.info("开始优雅停机...");

        // 停止接收新任务
        taskExecutor.shutdown();

        // 等待已提交的任务完成
        try {
            if (!taskExecutor.getThreadPoolExecutor().awaitTermination(30, TimeUnit.SECONDS)) {
                log.warn("线程池未能在 30 秒内完成所有任务，强制关闭");
                taskExecutor.getThreadPoolExecutor().shutdownNow();
            }
        } catch (InterruptedException e) {
            taskExecutor.getThreadPoolExecutor().shutdownNow();
            Thread.currentThread().interrupt();
        }

        log.info("优雅停机完成");
    }
}
```

> ⚠️ **Docker/K8s 中的优雅停机：** K8s 发送 SIGTERM 后默认等 30 秒，然后发 SIGKILL 强杀。确保 Spring 的超时时间比 K8s 的 terminationGracePeriodSeconds 短。

### 9.5 健康检查与就绪探针

K8s 部署时需要配置探针，告诉 K8s 容器的状态：

```yaml
# K8s Deployment 配置片段
spec:
  containers:
    - name: order-system
      image: order-system:1.0.0
      ports:
        - containerPort: 8080

      # 存活探针：容器是否活着
      # 失败 → K8s 重启容器
      livenessProbe:
        httpGet:
          path: /api/actuator/health/liveness
          port: 8080
        initialDelaySeconds: 60    # 启动后等 60 秒再开始探测
        periodSeconds: 10          # 每 10 秒探测一次
        failureThreshold: 3        # 连续失败 3 次才判定为不健康

      # 就绪探针：容器是否准备好接收流量
      # 失败 → K8s 不会把流量打到这个 Pod
      readinessProbe:
        httpGet:
          path: /api/actuator/health/readiness
          port: 8080
        initialDelaySeconds: 30
        periodSeconds: 10
        failureThreshold: 3

      # 启动探针：容器是否启动完成（Spring Boot 3.x 推荐使用）
      # 启动阶段失败 → K8s 重启容器
      # 启动成功后，存活探针和就绪探针才开始工作
      startupProbe:
        httpGet:
          path: /api/actuator/health
          port: 8080
        initialDelaySeconds: 10
        periodSeconds: 5
        failureThreshold: 30       # 最多等 10 + 5*30 = 160 秒启动
```

Spring Boot Actuator 已经内置了对 K8s 探针的支持：

```yaml
# application.yml
management:
  endpoint:
    health:
      probes:
        enabled: true             # 开启 K8s 探针端点
      group:
        liveness:
          include: livenessState  # 存活探针包含的检查项
        readiness:
          include: readinessState,db,redis  # 就绪探针包含的检查项（数据库和Redis好了才就绪）
```

这样 `/actuator/health/liveness` 和 `/actuator/health/readiness` 就可以直接给 K8s 用了。

---

> 至此，你已经掌握了 Spring Boot 企业级开发的核心知识。从项目搭建、三层架构、配置管理、数据库集成，到常用组件、日志监控、踩坑避雷，再到最终的部署上线，每个环节都有真实的代码示例和经验总结。
>
> 建议你以这份手册为骨架，在实际项目中不断实践和补充。写代码不是看会的，是写会的。动手去做，遇到问题再回来翻，才能真正内化这些知识。
