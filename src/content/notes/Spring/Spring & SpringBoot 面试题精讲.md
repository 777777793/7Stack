# Spring & Spring Boot 面试题精讲

> 基于 Spring Boot 3.x + Java 17，面向 Java 后端面试，共 50 题
> 难度标注：⭐ 基础 / ⭐⭐ 中等 / ⭐⭐⭐ 高频难题 / ⭐⭐⭐⭐ 高级
> 每题三层回答：面试直答版 / 深度解析版 / 加分项

---

## 一、Spring 基础概念

### 1. 什么是 Spring 框架？它解决了什么问题？

**🎯 面试直答版**

Spring 是一个轻量级的 Java 企业级开发框架，核心是 IoC 容器和 AOP。它解决了 Java EE 开发中对象创建和管理过于复杂、代码耦合度高、重复代码多的问题，让开发者可以专注于业务逻辑。

**📖 深度解析版**

Spring 框架诞生的背景是早期 Java EE（J2EE）开发的痛点：

1. **对象管理复杂**：传统开发中，对象之间的依赖关系需要手动管理，new 出来的对象难以统一管控。
2. **代码高度耦合**：业务代码和基础设施代码（事务、日志、安全等）混杂在一起。
3. **测试困难**：由于强依赖导致单元测试难以进行。
4. **重复造轮子**：每个项目都要处理相同的横切关注点（事务、安全、缓存等）。

Spring 通过以下核心特性来解决这些问题：

- **IoC（控制反转）**：将对象的创建和依赖管理交给 Spring 容器，降低耦合。
- **AOP（面向切面编程）**：将横切关注点（如事务、日志）从业务逻辑中剥离。
- **声明式事务管理**：通过注解或配置即可管理事务，无需手动编写事务代码。
- **丰富的生态**：提供了 MVC、Data、Security 等子项目，覆盖企业开发的方方面面。

**💡 加分项**

- Spring 的设计哲学是"不重复发明轮子"，而是对现有技术进行封装和简化。例如 JdbcTemplate 封装了 JDBC，RestTemplate 封装了 HTTP 调用。
- Spring 6.x / Spring Boot 3.x 开始全面拥抱 Jakarta EE（javax.* 迁移到 jakarta.*），并支持 GraalVM 原生镜像编译，这是面对云原生时代的重要演进。

---

### 2. 什么是 IoC？什么是 DI？它们的关系是什么？

**🎯 面试直答版**

IoC（控制反转）是一种设计思想，将对象创建和管理的控制权从程序员转交给 Spring 容器。DI（依赖注入）是 IoC 的具体实现方式，通过构造器、Setter 或字段注入的方式，将依赖对象注入到目标对象中。简单说，IoC 是思想，DI 是手段。

**📖 深度解析版**

**IoC（Inversion of Control）控制反转：**

传统开发中，对象 A 如果依赖对象 B，需要在 A 中主动创建 B：

```java
// 传统方式：A 主动创建依赖
public class UserService {
    private UserRepository repo = new UserRepositoryImpl(); // 强耦合
}
```

IoC 之后，A 不再主动创建 B，而是被动地接收容器注入的 B：

```java
// IoC 方式：由容器注入依赖
@Service
public class UserService {
    private final UserRepository repo; // 面向接口编程

    public UserService(UserRepository repo) {
        this.repo = repo; // 容器负责注入
    }
}
```

这里"反转"的是**控制权**：谁来创建对象、谁来管理依赖关系——从应用代码反转到了容器。

**DI（Dependency Injection）依赖注入：**

DI 是 IoC 的一种实现方式，Spring 支持三种注入方式：

```java
// 1. 构造器注入（推荐）
@Service
public class UserService {
    private final UserRepository repo;

    public UserService(UserRepository repo) {
        this.repo = repo;
    }
}

// 2. Setter 注入
@Service
public class UserService {
    private UserRepository repo;

    @Autowired
    public void setRepo(UserRepository repo) {
        this.repo = repo;
    }
}

// 3. 字段注入（不推荐）
@Service
public class UserService {
    @Autowired
    private UserRepository repo;
}
```

**💡 加分项**

- IoC 的实现方式不止 DI 一种，还有服务定位器（Service Locator）模式。但 Spring 主要采用 DI。
- Martin Fowler 在 2004 年提出用"依赖注入"来替代"控制反转"的叫法，因为"控制反转"这个名字太泛化了，几乎所有框架都在做某种形式的"控制反转"。
- 面试中可以提到 IoC 容器的本质就是一个 Map，key 是 beanName，value 是 Bean 实例（或 BeanDefinition）。

---

### 3. BeanFactory 和 ApplicationContext 有什么区别？

**🎯 面试直答版**

BeanFactory 是 Spring 最底层的容器接口，提供基础的 IoC 功能，采用懒加载策略。ApplicationContext 是 BeanFactory 的子接口，在其基础上扩展了国际化、事件机制、资源加载等企业级功能，默认采用饥饿加载（启动时就创建所有单例 Bean）。实际开发中几乎都使用 ApplicationContext。

**📖 深度解析版**

| 特性 | BeanFactory | ApplicationContext |
|------|------------|-------------------|
| Bean 加载策略 | 懒加载（用到时才创建） | 饥饿加载（启动时创建所有单例） |
| 国际化（i18n） | 不支持 | 支持（MessageSource） |
| 事件机制 | 不支持 | 支持（ApplicationEvent） |
| 资源加载 | 不支持 | 支持（ResourceLoader） |
| AOP 支持 | 需要手动配置 | 自动集成 |
| Environment | 不支持 | 支持（配置文件、Profile） |
| 注解驱动 | 有限支持 | 完全支持 |

BeanFactory 的继承关系：

```
BeanFactory
├── HierarchicalBeanFactory
├── ListableBeanFactory
└── AutowireCapableBeanFactory

ApplicationContext
├── ConfigurableApplicationContext
│   ├── AnnotationConfigApplicationContext（注解驱动）
│   ├── ClassPathXmlApplicationContext（XML 驱动）
│   └── GenericWebApplicationContext（Web 环境）
```

ApplicationContext 的常用实现类：

```java
// 基于注解的上下文（Spring Boot 默认使用）
var ctx = new AnnotationConfigApplicationContext(AppConfig.class);

// 基于 XML 的上下文（传统方式）
var ctx = new ClassPathXmlApplicationContext("applicationContext.xml");

// Spring Boot Web 应用使用的上下文
// AnnotationConfigServletWebServerApplicationContext
```

**💡 加分项**

- BeanFactory 的懒加载在某些场景下有优势：比如在资源受限环境或大量 Bean 但只用到少数几个的情况下。
- ApplicationContext 在启动时就创建所有单例 Bean，好处是能在启动阶段就发现配置错误（fail-fast），而不是等到运行时才暴露问题。
- Spring Boot 在 Web 环境下使用的是 `AnnotationConfigServletWebServerApplicationContext`，它不仅管理 Bean，还负责启动内嵌的 Web 服务器。

---

### 4. Spring 框架中用到了哪些设计模式？

**🎯 面试直答版**

Spring 中用到了大量设计模式，核心的有：工厂模式（BeanFactory）、单例模式（Bean 默认单例）、代理模式（AOP）、模板方法模式（JdbcTemplate）、观察者模式（事件机制）、适配器模式（HandlerAdapter）、策略模式（Resource 接口）。

**📖 深度解析版**

| 设计模式 | 在 Spring 中的应用 | 说明 |
|---------|-------------------|------|
| 工厂模式 | BeanFactory、FactoryBean | 通过工厂创建和管理 Bean |
| 单例模式 | DefaultSingletonBeanRegistry | Bean 默认是 singleton 作用域 |
| 代理模式 | AOP（JDK 动态代理、CGLIB） | 为目标对象创建代理以实现增强 |
| 模板方法 | JdbcTemplate、RestTemplate | 定义算法骨架，子步骤由子类实现 |
| 观察者模式 | ApplicationEvent、ApplicationListener | 事件发布与监听 |
| 适配器模式 | HandlerAdapter | 适配不同类型的 Controller |
| 策略模式 | Resource（ClassPathResource、UrlResource） | 根据不同协议加载资源 |
| 责任链模式 | Interceptor 链 | 请求经过多个拦截器依次处理 |
| 装饰器模式 | BeanWrapper | 对 Bean 属性进行包装增强 |
| 组合模式 | CompositeCacheManager | 将多个 CacheManager 组合为一个 |

重点说一下 FactoryBean 和 BeanFactory 的区别（面试常问）：

```java
// BeanFactory：Spring 的 IoC 容器，用于管理 Bean
ApplicationContext ctx = new AnnotationConfigApplicationContext(AppConfig.class);
Object bean = ctx.getBean("userService");

// FactoryBean：一种特殊的 Bean，本身是一个工厂，用于创建复杂对象
@Component
public class MyFactoryBean implements FactoryBean<ComplexObject> {
    @Override
    public ComplexObject getObject() {
        // 可以在这里写复杂的对象创建逻辑
        return new ComplexObject();
    }

    @Override
    public Class<?> getObjectType() {
        return ComplexObject.class;
    }
}

// 获取 FactoryBean 创建的对象
ctx.getBean("myFactoryBean");       // 返回 ComplexObject
// 获取 FactoryBean 本身
ctx.getBean("&myFactoryBean");      // 返回 MyFactoryBean
```

**💡 加分项**

- 面试中重点区分 BeanFactory 和 FactoryBean：前者是容器，后者是一种创建 Bean 的方式。MyBatis 的 SqlSessionFactoryBean 就是一个典型的 FactoryBean。
- Spring 的事件机制是观察者模式的典型应用，Spring Boot 启动过程中会发布多种事件：`ApplicationStartingEvent` -> `ApplicationEnvironmentPreparedEvent` -> `ApplicationContextInitializedEvent` -> `ApplicationPreparedEvent` -> `ApplicationStartedEvent` -> `ApplicationReadyEvent`。

---

### 5. Spring、Spring Boot、Spring MVC、Spring Cloud 分别是什么？

**🎯 面试直答版**

- **Spring**：是整个 Spring 生态的基础框架，提供 IoC 和 AOP 等核心功能。
- **Spring MVC**：是 Spring 的一个模块，用于构建 Web 应用的 MVC 框架。
- **Spring Boot**：是基于 Spring 的快速开发脚手架，通过自动配置和约定优于配置简化 Spring 应用的搭建。
- **Spring Cloud**：是基于 Spring Boot 的微服务工具集，提供服务注册、配置中心、网关等微服务基础设施。

**📖 深度解析版**

它们的层级关系可以这样理解：

```
Spring Cloud（微服务全家桶）
    └── 基于 Spring Boot（快速开发脚手架）
            └── 基于 Spring Framework（核心框架）
                    └── 包含 Spring MVC（Web 模块）
```

**Spring Framework：**
- 最核心的基础框架
- 提供 IoC、AOP、事务管理、数据访问等
- 模块化设计：spring-core、spring-beans、spring-context、spring-aop、spring-web 等

**Spring MVC：**
- Spring Framework 的 Web 模块（spring-webmvc）
- 实现了 MVC（Model-View-Controller）设计模式
- 核心组件：DispatcherServlet、HandlerMapping、HandlerAdapter、ViewResolver
- 处理 HTTP 请求和响应

**Spring Boot：**
- 不是新的框架，而是 Spring 的快速启动器
- 核心理念：约定优于配置（Convention over Configuration）
- 关键特性：自动配置、内嵌服务器、Starter 依赖、Actuator 监控

**Spring Cloud：**
- 基于 Spring Boot 构建的微服务工具集
- 核心组件：Eureka/Nacos（注册中心）、OpenFeign（服务调用）、Gateway（网关）、Config/Nacos（配置中心）、Sentinel（熔断限流）

**💡 加分项**

- 一个常见的误区是把 Spring Boot 当成一个独立的框架。实际上 Spring Boot 只是让使用 Spring 变得更简单，底层还是 Spring Framework。
- 在技术选型上，Spring Cloud Alibaba 已经成为国内微服务的主流选择（Nacos + Sentinel + Seata），而 Netflix OSS 组件（Eureka、Hystrix）很多已经进入维护模式。

---

### 6. 什么是 Spring Boot？它和 Spring 有什么区别？

**🎯 面试直答版**

Spring Boot 是基于 Spring Framework 的快速开发脚手架，核心思想是"约定优于配置"。它通过自动配置、内嵌服务器、Starter 机制，极大地简化了 Spring 应用的创建、配置和部署过程。Spring 是基础框架，Spring Boot 是让你更快使用 Spring 的工具。

**📖 深度解析版**

| 对比维度 | Spring | Spring Boot |
|---------|--------|-------------|
| 配置方式 | 大量 XML 或 Java Config | 自动配置 + 少量 properties/yaml |
| 依赖管理 | 手动管理每个依赖版本 | Starter + 版本仲裁（BOM） |
| Web 服务器 | 外部 Tomcat 部署 war | 内嵌 Tomcat/Jetty/Undertow，直接运行 jar |
| 项目搭建 | 手动配置 DispatcherServlet 等 | Spring Initializr 一键生成 |
| 监控 | 需要额外集成 | 内置 Actuator |
| 学习成本 | 高（需理解大量配置） | 低（开箱即用） |

Spring Boot 的四大核心特性：

```java
// 1. 自动配置：根据 classpath 中的依赖自动配置 Bean
// 引入 spring-boot-starter-web 后自动配置 DispatcherServlet、Tomcat 等

// 2. Starter 机制：一个 starter 搞定一组依赖
// spring-boot-starter-web 包含了 spring-web、spring-webmvc、tomcat、jackson 等

// 3. 内嵌服务器：无需部署 war 到外部 Tomcat
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args); // 直接运行
    }
}

// 4. Actuator：生产级监控
// /actuator/health   健康检查
// /actuator/metrics   指标监控
// /actuator/info      应用信息
```

**💡 加分项**

- Spring Boot 的版本仲裁机制（spring-boot-dependencies BOM）帮我们管理了几百个依赖的版本兼容性，这是工程效率的巨大提升。
- Spring Boot 3.x 要求 Java 17+，并迁移到了 Jakarta EE 9+（包名从 javax.* 变为 jakarta.*），这是一个重大变化，升级时需要特别注意。

---

## 二、Bean 相关

### 7. Spring Bean 的作用域有哪些？

**🎯 面试直答版**

Spring Bean 有五种作用域：singleton（单例，默认）、prototype（原型，每次获取创建新实例）、request（每个 HTTP 请求一个实例）、session（每个 HTTP Session 一个实例）、application（每个 ServletContext 一个实例）。其中 request、session、application 仅在 Web 环境下有效。

**📖 深度解析版**

| 作用域 | 说明 | 生命周期 |
|-------|------|---------|
| singleton | 整个 IoC 容器中只有一个实例（默认） | 容器启动到容器关闭 |
| prototype | 每次 getBean() 或注入时创建新实例 | 容器只负责创建，不管理后续生命周期 |
| request | 每个 HTTP 请求创建一个实例 | 请求开始到请求结束 |
| session | 每个 HTTP Session 创建一个实例 | Session 创建到 Session 过期 |
| application | 每个 ServletContext 创建一个实例 | 应用启动到应用关闭 |

```java
// 声明作用域
@Component
@Scope("prototype")
public class PrototypeBean {
    // 每次注入或获取都是新实例
}

// 在 singleton Bean 中使用 prototype Bean 的正确方式
@Component
public class SingletonBean {

    // 错误方式：prototype Bean 只会被注入一次，之后都是同一个实例
    // @Autowired
    // private PrototypeBean prototypeBean;

    // 正确方式1：通过 ObjectFactory
    @Autowired
    private ObjectFactory<PrototypeBean> prototypeBeanFactory;

    public void doSomething() {
        PrototypeBean bean = prototypeBeanFactory.getObject(); // 每次获取新实例
    }

    // 正确方式2：通过 @Lookup 方法注入
    @Lookup
    public PrototypeBean getPrototypeBean() {
        return null; // Spring 会重写这个方法
    }
}
```

⚠️ **易错点**：singleton Bean 中注入 prototype Bean 时，prototype Bean 不会每次都创建新实例！因为 singleton Bean 只初始化一次，注入也只发生一次。

**💡 加分项**

- 可以通过实现 `Scope` 接口自定义作用域。Spring Cloud 中的 `@RefreshScope` 就是一个自定义作用域的例子，当配置刷新时会销毁并重建 Bean。
- prototype 作用域的 Bean 不会触发 `@PreDestroy` 回调，因为 Spring 容器不管理 prototype Bean 的完整生命周期，创建后就交给调用方了。

---

### 8. Spring Bean 的生命周期是怎样的？（高频）

**🎯 面试直答版**

Spring Bean 的生命周期可以概括为四个阶段：实例化 -> 属性填充 -> 初始化 -> 销毁。详细来说就是：创建对象实例、注入依赖属性、调用 Aware 接口方法、执行 BeanPostProcessor 前置处理、执行初始化方法（@PostConstruct / InitializingBean / init-method）、执行 BeanPostProcessor 后置处理（AOP 代理在这里生成）、Bean 可用、容器关闭时执行销毁方法。

**📖 深度解析版**

完整的生命周期流程如下：

```
1. 实例化（Instantiation）
   └── 通过构造器或工厂方法创建 Bean 实例

2. 属性填充（Populate Properties）
   └── 注入依赖（@Autowired、@Value 等）

3. Aware 接口回调
   ├── BeanNameAware#setBeanName()
   ├── BeanClassLoaderAware#setBeanClassLoader()
   ├── BeanFactoryAware#setBeanFactory()
   ├── EnvironmentAware#setEnvironment()
   ├── ApplicationContextAware#setApplicationContext()
   └── ... 其他 Aware 接口

4. BeanPostProcessor#postProcessBeforeInitialization()
   └── 所有 BeanPostProcessor 的前置处理

5. 初始化
   ├── @PostConstruct 注解方法
   ├── InitializingBean#afterPropertiesSet()
   └── 自定义 init-method

6. BeanPostProcessor#postProcessAfterInitialization()
   └── AOP 代理就是在这一步生成的（AbstractAutoProxyCreator）

7. Bean 就绪，可以使用

8. 销毁（容器关闭时）
   ├── @PreDestroy 注解方法
   ├── DisposableBean#destroy()
   └── 自定义 destroy-method
```

代码示例，演示完整生命周期：

```java
@Component
public class LifecycleBean implements BeanNameAware, BeanFactoryAware,
        ApplicationContextAware, InitializingBean, DisposableBean {

    private String beanName;

    public LifecycleBean() {
        System.out.println("1. 构造器：实例化");
    }

    @Autowired
    public void setDependency(SomeDependency dep) {
        System.out.println("2. 属性填充：依赖注入");
    }

    @Override
    public void setBeanName(String name) {
        this.beanName = name;
        System.out.println("3. BeanNameAware#setBeanName: " + name);
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) {
        System.out.println("3. BeanFactoryAware#setBeanFactory");
    }

    @Override
    public void setApplicationContext(ApplicationContext ctx) {
        System.out.println("3. ApplicationContextAware#setApplicationContext");
    }

    @PostConstruct
    public void postConstruct() {
        System.out.println("5. @PostConstruct");
    }

    @Override
    public void afterPropertiesSet() {
        System.out.println("5. InitializingBean#afterPropertiesSet");
    }

    @PreDestroy
    public void preDestroy() {
        System.out.println("8. @PreDestroy");
    }

    @Override
    public void destroy() {
        System.out.println("8. DisposableBean#destroy");
    }
}

// BeanPostProcessor 是全局的，对所有 Bean 生效
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        System.out.println("4. BeanPostProcessor#postProcessBeforeInitialization: " + beanName);
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        System.out.println("6. BeanPostProcessor#postProcessAfterInitialization: " + beanName);
        return bean; // 可以返回代理对象
    }
}
```

⚠️ **易错点**：初始化方法的执行顺序是 `@PostConstruct` -> `InitializingBean#afterPropertiesSet()` -> 自定义 `init-method`，不要搞混。

**💡 加分项**

- `BeanPostProcessor` 是 Spring 扩展点中最重要的一个。`@Autowired` 的处理（`AutowiredAnnotationBeanPostProcessor`）、AOP 代理的生成（`AbstractAutoProxyCreator`）、`@Async` 的处理等都是通过 BeanPostProcessor 实现的。
- `InstantiationAwareBeanPostProcessor` 是 `BeanPostProcessor` 的子接口，在实例化阶段就介入，可以用于返回代理对象替代原始 Bean（在实例化之前就拦截）。
- 面试可以提到：如果让你实现一个自定义注解来做某种功能，核心思路就是自定义 BeanPostProcessor，在 `postProcessAfterInitialization` 中扫描注解并做增强。

---

### 9. Spring 中的单例 Bean 是线程安全的吗？

**🎯 面试直答版**

不是。Spring 只保证 Bean 的创建是单例的，不保证线程安全。如果单例 Bean 中有可变的共享状态（成员变量），在多线程并发访问时就会出现线程安全问题。通常来说，无状态的 Bean（如 Controller、Service、Repository）是线程安全的，因为它们不保存可变状态。

**📖 深度解析版**

```java
// 线程不安全的例子
@Service
public class UnsafeCounterService {
    private int count = 0; // 可变共享状态！

    public void increment() {
        count++; // 多线程并发时会出问题
    }
}

// 线程安全的例子
@Service
public class SafeUserService {
    private final UserRepository userRepo; // 不可变引用，指向的也是无状态 Bean

    public SafeUserService(UserRepository userRepo) {
        this.userRepo = userRepo;
    }

    public User findById(Long id) {
        return userRepo.findById(id).orElse(null); // 无共享可变状态
    }
}
```

解决单例 Bean 线程安全问题的方案：

```java
// 方案1：避免使用可变成员变量（最推荐）
@Service
public class StatelessService {
    // 只注入其他无状态的 Bean，不定义可变字段
    private final UserRepository userRepo;
    // ...
}

// 方案2：使用 ThreadLocal
@Service
public class ThreadLocalService {
    private static final ThreadLocal<SimpleDateFormat> dateFormatHolder =
        ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

    public String formatDate(Date date) {
        return dateFormatHolder.get().format(date);
    }
}

// 方案3：使用同步机制（性能差，不推荐）
@Service
public class SynchronizedService {
    private int count = 0;

    public synchronized void increment() {
        count++;
    }
}

// 方案4：改为 prototype 作用域（每次创建新实例）
@Service
@Scope("prototype")
public class PrototypeService {
    private int count = 0;
}
```

**💡 加分项**

- 实际开发中，大部分 Service、Controller、Repository 都是无状态的（只依赖其他 Bean，不保存请求相关的可变数据），所以天然线程安全。
- 如果确实需要在 Bean 中保存状态，优先考虑 ThreadLocal 或使用 `java.util.concurrent` 包下的原子类（AtomicInteger 等）。
- Spring 的事务管理就使用了 ThreadLocal 来保存当前线程的数据库连接，保证同一事务中的多次 SQL 操作使用同一个连接。

---

### 10. @Autowired 和 @Resource 有什么区别？

**🎯 面试直答版**

`@Autowired` 是 Spring 的注解，默认按类型（byType）注入；`@Resource` 是 Jakarta EE 的注解，默认按名称（byName）注入。当同一类型有多个实现时，`@Autowired` 需要配合 `@Qualifier` 指定名称，而 `@Resource` 可以直接通过 `name` 属性指定。

**📖 深度解析版**

| 对比维度 | @Autowired | @Resource |
|---------|-----------|-----------|
| 来源 | Spring（org.springframework） | Jakarta EE（jakarta.annotation） |
| 注入方式 | 默认 byType | 默认 byName，找不到再 byType |
| 必须存在 | 默认必须（可设 required=false） | 默认必须 |
| 支持位置 | 字段、构造器、Setter、方法参数 | 字段、Setter |
| 指定名称 | 配合 @Qualifier | 直接用 name 属性 |
| 构造器注入 | 支持 | 不支持 |

```java
public interface MessageService {
    String send(String msg);
}

@Service("emailService")
public class EmailService implements MessageService {
    public String send(String msg) { return "Email: " + msg; }
}

@Service("smsService")
public class SmsService implements MessageService {
    public String send(String msg) { return "SMS: " + msg; }
}

// @Autowired 用法
@Component
public class NotificationController {

    // 方式1：@Autowired + @Qualifier
    @Autowired
    @Qualifier("emailService")
    private MessageService messageService;

    // 方式2：字段名匹配 Bean 名称（不推荐，依赖字段命名）
    @Autowired
    private MessageService emailService; // 字段名 = Bean 名
}

// @Resource 用法
@Component
public class NotificationController {

    // 方式1：通过 name 指定
    @Resource(name = "emailService")
    private MessageService messageService;

    // 方式2：字段名匹配 Bean 名称
    @Resource
    private MessageService emailService; // 字段名 = Bean 名
}
```

`@Autowired` 的完整匹配流程：
1. 先按类型查找所有候选 Bean
2. 如果找到多个，再按字段名/参数名匹配 Bean 名称
3. 如果还是匹配不上，看有没有 `@Qualifier` 或 `@Primary`
4. 都没有就报 `NoUniqueBeanDefinitionException`

`@Resource` 的完整匹配流程：
1. 如果指定了 `name` 属性，按 name 查找
2. 如果没指定 name，按字段名查找
3. 字段名找不到，退化为按类型查找

**💡 加分项**

- Spring 团队推荐使用构造器注入，此时不需要任何注解（Spring 4.3+ 如果只有一个构造器，自动注入）。
- `@Resource` 属于 Jakarta EE 标准，如果你想减少对 Spring 的依赖，可以优先使用 `@Resource`，但实际上大部分项目都深度绑定 Spring，这个区别意义不大。
- Spring Boot 3.x 中 `@Resource` 的包名已从 `javax.annotation` 变为 `jakarta.annotation`。

---

### 11. Spring 是如何解决循环依赖的？（高频难题）

**🎯 面试直答版**

Spring 通过"三级缓存"来解决 Setter 注入和字段注入方式下的单例 Bean 循环依赖问题。三级缓存分别是：一级缓存（成品 Bean）、二级缓存（半成品 Bean / 早期代理对象）、三级缓存（ObjectFactory，用于生成早期引用）。核心思路是先将半成品 Bean 暴露出来，让其他 Bean 能够引用到它，再完成后续的属性填充和初始化。

⚠️ 注意：构造器注入的循环依赖 Spring 无法解决（可以用 @Lazy 打破）。

**📖 深度解析版**

三级缓存的定义（在 `DefaultSingletonBeanRegistry` 中）：

```java
/** 一级缓存：存放完全初始化好的 Bean（成品） */
private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

/** 二级缓存：存放早期暴露的 Bean（半成品，可能已被代理） */
private final Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>(16);

/** 三级缓存：存放 ObjectFactory，用于生成早期引用 */
private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);
```

假设 A 和 B 互相依赖，解决流程：

```
1. 创建 A：
   ├── 实例化 A（调用构造器，得到半成品 A）
   ├── 将 A 的 ObjectFactory 放入三级缓存
   ├── 填充属性：发现需要 B
   │
   ├── 2. 创建 B：
   │   ├── 实例化 B（调用构造器，得到半成品 B）
   │   ├── 将 B 的 ObjectFactory 放入三级缓存
   │   ├── 填充属性：发现需要 A
   │   │
   │   ├── 3. 获取 A：
   │   │   ├── 一级缓存没有 A
   │   │   ├── 二级缓存没有 A
   │   │   ├── 三级缓存有 A 的 ObjectFactory
   │   │   ├── 调用 ObjectFactory.getObject() 获取 A 的早期引用
   │   │   │   └── 如果 A 需要 AOP 代理，这里会提前生成代理对象
   │   │   ├── 将 A 的早期引用放入二级缓存，从三级缓存移除
   │   │   └── 返回 A 的早期引用给 B
   │   │
   │   ├── B 的属性填充完成（拿到了 A 的早期引用）
   │   ├── B 初始化完成
   │   └── B 放入一级缓存（成品）
   │
   ├── A 拿到了完整的 B
   ├── A 的属性填充完成
   ├── A 初始化完成
   └── A 放入一级缓存（成品）
```

```java
// 循环依赖示例
@Service
public class ServiceA {
    @Autowired
    private ServiceB serviceB; // Setter/字段注入，可以解决循环依赖
}

@Service
public class ServiceB {
    @Autowired
    private ServiceA serviceA;
}

// 构造器注入的循环依赖，Spring 无法解决
@Service
public class ServiceA {
    private final ServiceB serviceB;
    public ServiceA(ServiceB serviceB) { // 构造器注入
        this.serviceB = serviceB;
    }
}

@Service
public class ServiceB {
    private final ServiceA serviceA;
    public ServiceB(ServiceA serviceA) { // 构造器注入
        this.serviceA = serviceA;
    }
}
// 启动报错：BeanCurrentlyInCreationException

// 解决构造器注入循环依赖：使用 @Lazy
@Service
public class ServiceA {
    private final ServiceB serviceB;
    public ServiceA(@Lazy ServiceB serviceB) { // @Lazy 注入代理
        this.serviceB = serviceB;
    }
}
```

⚠️ **为什么需要三级缓存，二级不行吗？**

核心原因是 **AOP 代理**。如果只有二级缓存，在暴露早期引用时就必须判断是否需要创建代理对象。而三级缓存通过 ObjectFactory 延迟了这个判断——只有真正被其他 Bean 引用时，才会通过 ObjectFactory 决定是返回原始对象还是代理对象。

⚠️ **Spring Boot 2.6+ 默认禁止循环依赖**，需要通过 `spring.main.allow-circular-references=true` 显式开启。

**💡 加分项**

- 从设计角度来说，循环依赖本身是一种设计缺陷，说明两个类的职责划分不清。面试中可以提到，解决循环依赖最好的方式是重构代码、引入中间层来打破循环。
- `@Lazy` 的原理是注入一个代理对象，在实际调用方法时才去容器中获取真实的 Bean，从而打破了创建时的循环。
- prototype 作用域的循环依赖 Spring 无法解决，因为 prototype Bean 不会被缓存。

---

### 12. 为什么 Spring 推荐构造器注入？

**🎯 面试直答版**

Spring 推荐构造器注入有四个主要原因：1）保证依赖不可变（final 修饰）；2）保证依赖不为空（构造器强制要求传入）；3）保证 Bean 完全初始化后才可用；4）便于编写单元测试（不需要反射或 Spring 容器）。

**📖 深度解析版**

```java
// 字段注入（不推荐）
@Service
public class UserService {
    @Autowired
    private UserRepository userRepo; // 可能为 null、可变、难以测试

    @Autowired
    private EmailService emailService;
}

// 构造器注入（推荐）
@Service
public class UserService {
    private final UserRepository userRepo;     // 不可变
    private final EmailService emailService;   // 不可变

    // Spring 4.3+ 单构造器可以省略 @Autowired
    public UserService(UserRepository userRepo, EmailService emailService) {
        this.userRepo = userRepo;       // 不会为 null
        this.emailService = emailService;
    }
}
```

构造器注入的优点详细分析：

| 优点 | 说明 |
|------|------|
| 依赖不可变 | 用 final 修饰，防止被意外修改 |
| 依赖不为空 | 构造器参数强制传入，不可能为 null |
| 完全初始化 | 对象创建出来就是完整可用的状态 |
| 易于测试 | 单元测试时直接 new 就行，不需要 Spring 容器 |
| 发现设计问题 | 如果构造器参数太多，提示该类职责过重 |

```java
// 构造器注入的测试优势
@Test
void testFindUser() {
    // 不需要 Spring 容器，直接 new + mock
    var mockRepo = Mockito.mock(UserRepository.class);
    var mockEmail = Mockito.mock(EmailService.class);
    var service = new UserService(mockRepo, mockEmail);

    // 测试逻辑...
}
```

⚠️ **字段注入的问题**：
- 字段注入依赖反射，如果不通过 Spring 容器创建对象，依赖就是 null。
- 字段注入无法声明 final，依赖可能被修改。
- 字段注入隐藏了类的依赖关系，不看源码不知道它依赖了什么。

**💡 加分项**

- 如果使用 Lombok，可以用 `@RequiredArgsConstructor` 自动生成构造器，让代码更简洁：

```java
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepo;
    private final EmailService emailService;
    // Lombok 自动生成构造器
}
```

- 构造器注入的一个"缺点"是无法解决循环依赖，但正如前面所说，循环依赖本身就是设计问题。

---

### 13. @Component、@Service、@Repository、@Controller 有什么区别？

**🎯 面试直答版**

这四个注解本质上功能相同，都是将类注册为 Spring Bean。区别在于语义：`@Component` 是通用组件、`@Service` 标识业务层、`@Repository` 标识数据层、`@Controller` 标识控制层。其中 `@Repository` 额外提供了数据访问异常转换功能，`@Controller` 配合 Spring MVC 处理 HTTP 请求。

**📖 深度解析版**

从源码来看，`@Service`、`@Repository`、`@Controller` 都是 `@Component` 的派生注解：

```java
// @Service 的源码
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Component  // 本质就是 @Component
public @interface Service {
    @AliasFor(annotation = Component.class)
    String value() default "";
}

// @Repository 的源码
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Component  // 本质就是 @Component
public @interface Repository {
    @AliasFor(annotation = Component.class)
    String value() default "";
}
```

它们的差异：

| 注解 | 层次 | 特殊功能 |
|------|------|---------|
| @Component | 通用 | 无 |
| @Service | 业务层 | 无（纯语义标识） |
| @Repository | 数据层 | 开启数据访问异常转换（PersistenceExceptionTranslation） |
| @Controller | 控制层 | 配合 @RequestMapping 处理 HTTP 请求 |

`@Repository` 的异常转换功能：

```java
@Repository
public class UserDaoImpl implements UserDao {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    public User findById(Long id) {
        // 如果抛出 SQLException，会被自动转换为 Spring 的 DataAccessException
        return jdbcTemplate.queryForObject("SELECT * FROM user WHERE id = ?",
            new BeanPropertyRowMapper<>(User.class), id);
    }
}
```

**💡 加分项**

- 虽然互换使用不会报错（比如把 @Service 换成 @Component），但遵循分层约定有助于代码可读性和维护。
- 一些框架和工具会根据注解类型做特殊处理。例如 Spring 的 PersistenceExceptionTranslationPostProcessor 只对 @Repository 标注的 Bean 做异常转换。
- 在分层架构中，还可以基于注解做 AOP 切面，比如只对 @Service 层做事务管理。

---

### 14. @Configuration 和 @Component 有什么区别？

**🎯 面试直答版**

两者都能注册 Bean，但 `@Configuration` 会被 CGLIB 代理增强，保证 `@Bean` 方法之间的调用返回的是同一个单例对象（Full 模式）。而 `@Component` 中的 `@Bean` 方法就是普通的 Java 方法调用，每次调用都会创建新对象（Lite 模式）。

**📖 深度解析版**

```java
// @Configuration（Full 模式）：@Bean 方法互调返回同一实例
@Configuration
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource();
    }

    @Bean
    public JdbcTemplate jdbcTemplate() {
        // 这里调用 dataSource() 返回的是容器中的单例 Bean
        // 因为 @Configuration 类被 CGLIB 代理了
        return new JdbcTemplate(dataSource());
    }
}

// @Component（Lite 模式）：@Bean 方法互调会创建新实例
@Component
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource();
    }

    @Bean
    public JdbcTemplate jdbcTemplate() {
        // 这里调用 dataSource() 会创建一个新的 DataSource 实例！
        // 和容器中的 DataSource Bean 不是同一个对象
        return new JdbcTemplate(dataSource());
    }
}
```

原理分析：

```java
// @Configuration 的 proxyBeanMethods 属性（Spring 5.2+）
@Configuration(proxyBeanMethods = true)   // 默认 true，Full 模式
@Configuration(proxyBeanMethods = false)  // Lite 模式，等同于 @Component 中定义 @Bean
```

| 模式 | 注解 | @Bean 方法互调 | CGLIB 代理 | 启动速度 |
|------|------|---------------|-----------|---------|
| Full 模式 | @Configuration | 返回容器中的单例 | 是 | 稍慢 |
| Lite 模式 | @Component 或 proxyBeanMethods=false | 创建新实例 | 否 | 稍快 |

⚠️ **易错点**：在 `@Component` 类中定义 `@Bean` 方法，如果 Bean 之间有依赖，不要通过方法互调，应该通过方法参数注入：

```java
@Component
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource();
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) { // 通过参数注入
        return new JdbcTemplate(dataSource); // 这样拿到的就是容器中的单例
    }
}
```

**💡 加分项**

- Spring Boot 3.x 中大量使用 `@Configuration(proxyBeanMethods = false)` 来提升启动速度，因为不需要 CGLIB 代理。
- 面试追问"proxyBeanMethods = false 和 true 的区别"就是这个知识点。

---

### 15. 如果一个接口有多个实现类，Spring 怎么注入？

**🎯 面试直答版**

有五种方式：1）`@Qualifier` 指定 Bean 名称；2）`@Primary` 标注首选 Bean；3）字段名/参数名匹配 Bean 名称；4）使用 `@Resource(name="xxx")` 按名称注入；5）注入 `List<接口>` 或 `Map<String, 接口>` 获取所有实现。

**📖 深度解析版**

```java
public interface PayService {
    void pay(BigDecimal amount);
}

@Service("alipayService")
public class AlipayService implements PayService {
    public void pay(BigDecimal amount) { /* 支付宝支付 */ }
}

@Service("wechatPayService")
public class WechatPayService implements PayService {
    public void pay(BigDecimal amount) { /* 微信支付 */ }
}

// 方式1：@Qualifier 指定
@Service
public class OrderService {
    @Autowired
    @Qualifier("alipayService")
    private PayService payService;
}

// 方式2：@Primary 标注首选
@Service
@Primary  // 当有多个实现时，优先注入这个
public class AlipayService implements PayService { }

@Service
public class OrderService {
    @Autowired  // 会注入标了 @Primary 的 AlipayService
    private PayService payService;
}

// 方式3：字段名匹配
@Service
public class OrderService {
    @Autowired
    private PayService alipayService; // 字段名 = Bean 名，自动匹配
}

// 方式4：@Resource 按名称
@Service
public class OrderService {
    @Resource(name = "wechatPayService")
    private PayService payService;
}

// 方式5：注入所有实现（策略模式常用）
@Service
public class OrderService {
    @Autowired
    private List<PayService> payServices; // 注入所有实现

    @Autowired
    private Map<String, PayService> payServiceMap; // key=Bean名, value=实例

    public void pay(String type, BigDecimal amount) {
        PayService service = payServiceMap.get(type + "Service");
        if (service != null) {
            service.pay(amount);
        }
    }
}
```

**💡 加分项**

- 注入 `Map<String, PayService>` 是策略模式在 Spring 中最优雅的实现方式，可以动态根据类型选择实现。
- 可以通过 `@Order` 或实现 `Ordered` 接口来控制 `List` 中实现类的顺序。
- `@Qualifier` 也可以自定义组合注解，用于更细粒度的分组。

---

## 三、AOP 相关

### 16. 什么是 AOP？Spring AOP 的实现原理？

**🎯 面试直答版**

AOP（面向切面编程）是一种编程范式，用于将横切关注点（如日志、事务、权限）从业务逻辑中剥离出来。Spring AOP 基于动态代理实现：对于实现了接口的类使用 JDK 动态代理，对于没有实现接口的类使用 CGLIB 字节码代理。在 Spring Boot 中默认全部使用 CGLIB 代理。

**📖 深度解析版**

AOP 的核心概念：

| 术语 | 说明 | 示例 |
|------|------|------|
| 切面（Aspect） | 横切关注点的模块化 | 日志切面、事务切面 |
| 连接点（JoinPoint） | 程序执行中的某个点 | 方法调用、异常抛出 |
| 通知（Advice） | 切面在连接点执行的动作 | @Before、@After、@Around |
| 切入点（Pointcut） | 匹配连接点的表达式 | execution(* com.example.service.*.*(..)) |
| 目标对象（Target） | 被代理的原始对象 | UserService |
| 代理对象（Proxy） | AOP 创建的代理对象 | UserService$$EnhancerBySpringCGLIB |
| 织入（Weaving） | 将切面应用到目标对象 | 运行时动态代理 |

```java
// 定义一个日志切面
@Aspect
@Component
public class LogAspect {

    // 定义切入点
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void servicePointcut() {}

    // 前置通知
    @Before("servicePointcut()")
    public void before(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();
        System.out.println("调用方法: " + methodName + ", 参数: " + Arrays.toString(args));
    }

    // 环绕通知（最强大）
    @Around("servicePointcut()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        try {
            Object result = pjp.proceed(); // 执行目标方法
            return result;
        } finally {
            long cost = System.currentTimeMillis() - start;
            System.out.println("方法耗时: " + cost + "ms");
        }
    }
}
```

Spring AOP 的代理机制：

```java
// JDK 动态代理（基于接口）
public class JdkProxy implements InvocationHandler {
    private Object target;

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        System.out.println("前置增强");
        Object result = method.invoke(target, args);
        System.out.println("后置增强");
        return result;
    }
}

// CGLIB 代理（基于继承）
public class CglibProxy implements MethodInterceptor {
    @Override
    public Object intercept(Object obj, Method method, Object[] args,
                           MethodProxy proxy) throws Throwable {
        System.out.println("前置增强");
        Object result = proxy.invokeSuper(obj, method, args);
        System.out.println("后置增强");
        return result;
    }
}
```

**💡 加分项**

- Spring Boot 2.x 开始默认使用 CGLIB 代理（`spring.aop.proxy-target-class=true`），不再区分是否实现了接口。
- AOP 的底层是在 `BeanPostProcessor#postProcessAfterInitialization` 阶段通过 `AbstractAutoProxyCreator` 创建代理对象的。

---

### 17. JDK 动态代理和 CGLIB 代理有什么区别？

**🎯 面试直答版**

JDK 动态代理基于接口，通过 `java.lang.reflect.Proxy` 生成代理类，要求目标对象必须实现接口。CGLIB 代理基于继承，通过字节码技术（ASM）生成目标类的子类，不要求实现接口，但不能代理 final 类和 final 方法。Spring Boot 默认使用 CGLIB 代理。

**📖 深度解析版**

| 对比维度 | JDK 动态代理 | CGLIB 代理 |
|---------|------------|-----------|
| 实现机制 | 基于接口（java.lang.reflect.Proxy） | 基于继承（ASM 字节码） |
| 要求 | 目标类必须实现接口 | 目标类不能是 final |
| 代理对象类型 | 接口的实现类 | 目标类的子类 |
| 方法限制 | 只能代理接口方法 | 不能代理 final 方法 |
| 性能（创建） | 较快 | 较慢（需生成字节码） |
| 性能（调用） | 反射调用，JDK 高版本已优化 | 通过 FastClass 直接调用，较快 |
| Spring Boot 默认 | 否 | 是（2.x 开始） |

```java
// JDK 动态代理示例
public interface UserService {
    void save(User user);
}

@Service
public class UserServiceImpl implements UserService {
    public void save(User user) { /* ... */ }
}

// 生成的代理类大概是：
// $Proxy0 implements UserService { ... }

// CGLIB 代理示例
@Service
public class OrderService {  // 没有实现接口
    public void createOrder(Order order) { /* ... */ }
}

// 生成的代理类大概是：
// OrderService$$EnhancerBySpringCGLIB$$xxxx extends OrderService { ... }
```

⚠️ **CGLIB 的限制**：

```java
// final 类不能被 CGLIB 代理
@Service
public final class FinalService {  // 启动报错！
    public void doSomething() {}
}

// final 方法不会被代理增强
@Service
public class SomeService {
    public final void finalMethod() {
        // 这个方法不会被 AOP 增强，因为 CGLIB 无法重写 final 方法
    }
}
```

**💡 加分项**

- 在 Spring Boot 中可以通过 `spring.aop.proxy-target-class=false` 切换回 JDK 动态代理，但一般没必要。
- JDK 17+ 的反射性能已经大幅提升，JDK 动态代理的调用性能和 CGLIB 相差不大。
- CGLIB 代理因为是基于继承的，所以代理对象会调用目标类的无参构造器。如果目标类没有无参构造器，可能会出问题（不过 Spring 使用的是 Objenesis 来跳过构造器）。

---

### 18. Spring AOP 和 AspectJ 有什么区别？

**🎯 面试直答版**

Spring AOP 是运行时增强，基于动态代理实现，只支持方法级别的切面，性能有一定开销。AspectJ 是编译时/加载时增强，通过修改字节码实现，支持方法、字段、构造器等各种级别的切面，功能更强大但配置更复杂。Spring AOP 能满足大部分需求，AspectJ 用于更底层的场景。

**📖 深度解析版**

| 对比维度 | Spring AOP | AspectJ |
|---------|-----------|---------|
| 增强方式 | 运行时动态代理 | 编译时（CTW）或加载时（LTW）织入 |
| 实现原理 | JDK Proxy / CGLIB | 修改目标类的字节码 |
| 支持的 JoinPoint | 仅方法执行 | 方法、字段、构造器、异常处理等 |
| 性能 | 有代理调用开销 | 无额外运行时开销 |
| 配置复杂度 | 简单（注解即可） | 复杂（需要额外编译器或 agent） |
| 自调用问题 | 有（this 调用不走代理） | 无 |
| 使用场景 | 大部分业务场景 | 底层框架、极致性能要求 |

```java
// Spring AOP（运行时代理，够用）
@Aspect
@Component
public class PerformanceAspect {
    @Around("execution(* com.example.service.*.*(..))")
    public Object measure(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        Object result = pjp.proceed();
        long cost = System.nanoTime() - start;
        System.out.println(pjp.getSignature().getName() + " 耗时: " + cost / 1_000_000 + "ms");
        return result;
    }
}

// AspectJ 可以做到但 Spring AOP 做不到的事情：
// 1. 拦截字段访问
// 2. 拦截构造器调用
// 3. 拦截 this 内部调用
// 4. 拦截静态方法
```

**💡 加分项**

- Spring AOP 借用了 AspectJ 的注解（`@Aspect`、`@Before`、`@Around` 等），但底层实现完全不同。这叫做"基于 AspectJ 风格的 Spring AOP"。
- 如果项目中确实需要 AspectJ 的能力（比如拦截 private 方法），可以配置 LTW（Load-Time Weaving）模式。
- 实际开发中 99% 的场景 Spring AOP 就够用了。

---

### 19. AOP 的通知类型有哪些？执行顺序是什么？

**🎯 面试直答版**

AOP 有五种通知类型：`@Before`（前置）、`@After`（后置）、`@AfterReturning`（返回后）、`@AfterThrowing`（异常后）、`@Around`（环绕）。正常执行顺序是：Around 前半段 -> Before -> 目标方法 -> AfterReturning -> After -> Around 后半段。异常时：Around 前半段 -> Before -> 目标方法异常 -> AfterThrowing -> After。

**📖 深度解析版**

```java
@Aspect
@Component
public class DemoAspect {

    @Around("execution(* com.example.service.*.*(..))")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        System.out.println("1. Around - 前");
        try {
            Object result = pjp.proceed();
            System.out.println("5. Around - 后（正常）");
            return result;
        } catch (Exception e) {
            System.out.println("5. Around - 后（异常）");
            throw e;
        }
    }

    @Before("execution(* com.example.service.*.*(..))")
    public void before() {
        System.out.println("2. Before");
    }

    @AfterReturning(pointcut = "execution(* com.example.service.*.*(..))",
                    returning = "result")
    public void afterReturning(Object result) {
        System.out.println("3. AfterReturning, 返回值: " + result);
    }

    @AfterThrowing(pointcut = "execution(* com.example.service.*.*(..))",
                   throwing = "ex")
    public void afterThrowing(Exception ex) {
        System.out.println("3. AfterThrowing, 异常: " + ex.getMessage());
    }

    @After("execution(* com.example.service.*.*(..))")
    public void after() {
        System.out.println("4. After（类似 finally，总会执行）");
    }
}
```

正常执行：
```
1. Around - 前
2. Before
   [目标方法执行]
3. AfterReturning
4. After
5. Around - 后
```

异常执行：
```
1. Around - 前
2. Before
   [目标方法异常]
3. AfterThrowing
4. After
5. Around - 后（异常）
```

⚠️ **注意**：Spring 5.2.7+ 对执行顺序做了调整。在此之前，After 会在 AfterReturning/AfterThrowing 之前执行。

多个切面之间的执行顺序可以通过 `@Order` 控制：

```java
@Aspect
@Component
@Order(1)  // 数值越小，优先级越高
public class SecurityAspect { /* ... */ }

@Aspect
@Component
@Order(2)
public class LogAspect { /* ... */ }

// 执行顺序类似"洋葱模型"：
// Security Before -> Log Before -> 目标方法 -> Log After -> Security After
```

**💡 加分项**

- `@Around` 是最强大的通知类型，它可以完全控制目标方法的执行（包括是否执行、修改参数、修改返回值、处理异常）。
- 实际开发中，简单的日志记录用 `@Before` + `@AfterReturning`，复杂的需求（如性能监控、事务控制）用 `@Around`。

---

### 20. 在哪些场景下 AOP 会失效？

**🎯 面试直答版**

AOP 失效的常见场景：1）同类中方法 A 调用方法 B（this 调用不走代理）；2）方法是 private 的；3）方法是 final 的（CGLIB 无法重写）；4）方法是 static 的；5）Bean 未被 Spring 管理；6）目标类被提前初始化，未被代理。最常见的坑就是自调用问题。

**📖 深度解析版**

**场景1：自调用问题（最常见的坑）**

```java
@Service
public class OrderService {

    @Transactional
    public void createOrder(Order order) {
        // 业务逻辑
        saveOrder(order);
        sendNotification(order); // this 调用，不走代理！
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendNotification(Order order) {
        // 这个方法的事务不会生效！
        // 因为是 this.sendNotification()，没有经过代理对象
    }
}
```

解决方案：

```java
// 方案1：注入自身（推荐）
@Service
public class OrderService {
    @Autowired
    private OrderService self; // 注入代理对象

    public void createOrder(Order order) {
        saveOrder(order);
        self.sendNotification(order); // 通过代理对象调用
    }
}

// 方案2：从 ApplicationContext 获取
@Service
public class OrderService {
    @Autowired
    private ApplicationContext ctx;

    public void createOrder(Order order) {
        OrderService proxy = ctx.getBean(OrderService.class);
        proxy.sendNotification(order);
    }
}

// 方案3：使用 AopContext（需要开启 exposeProxy）
@EnableAspectJAutoProxy(exposeProxy = true)
@Configuration
public class AopConfig {}

@Service
public class OrderService {
    public void createOrder(Order order) {
        OrderService proxy = (OrderService) AopContext.currentProxy();
        proxy.sendNotification(order);
    }
}
```

**场景2：private / final / static 方法**

```java
@Service
public class UserService {
    // private 方法：AOP 不生效（代理无法访问 private 方法）
    @Transactional
    private void privateMethod() { }

    // final 方法：CGLIB 无法重写，AOP 不生效
    @Transactional
    public final void finalMethod() { }

    // static 方法：AOP 不生效（代理是基于实例的）
    @Transactional
    public static void staticMethod() { }
}
```

**场景3：Bean 未被 Spring 管理**

```java
// 手动 new 的对象不走 Spring 代理
UserService service = new UserService(); // 不是代理对象！
service.someMethod(); // AOP 不生效
```

⚠️ **高频易错点汇总**：

| 失效场景 | 原因 | 解决方案 |
|---------|------|---------|
| 自调用（this 调用） | 绕过了代理对象 | 注入自身/AopContext |
| private 方法 | 代理无法访问 | 改为 public 或 protected |
| final 方法 | CGLIB 无法重写 | 去掉 final |
| static 方法 | 代理基于实例 | 改为实例方法 |
| 未被 Spring 管理 | 不是代理对象 | 通过容器获取 Bean |

**💡 加分项**

- 自调用问题的根本原因是 Spring AOP 基于代理模式，而 `this` 指向的是原始对象而非代理对象。如果使用 AspectJ 的编译时织入就不存在这个问题。
- 在 Spring Boot 中，`@Async` 也有同样的自调用失效问题，原理一致。

---

## 四、Spring Boot 核心

### 21. Spring Boot 的自动配置原理是什么？（高频）

**🎯 面试直答版**

Spring Boot 自动配置的核心是 `@EnableAutoConfiguration` 注解。它通过 `AutoConfigurationImportSelector` 读取 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 文件中声明的自动配置类，再结合 `@Conditional` 条件注解，只有满足条件的配置才会生效。简单说就是：扫描候选配置类 -> 条件过滤 -> 注册 Bean。

**📖 深度解析版**

自动配置的完整链路：

```
@SpringBootApplication
    └── @EnableAutoConfiguration
            └── @Import(AutoConfigurationImportSelector.class)
                    └── selectImports()
                            └── 读取 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
                                    └── 加载所有候选自动配置类
                                            └── @Conditional 条件过滤
                                                    └── 符合条件的配置类生效，注册 Bean
```

以 `DataSourceAutoConfiguration` 为例：

```java
@AutoConfiguration(before = SqlInitializationAutoConfiguration.class)
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @Conditional(EmbeddedDatabaseCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import(EmbeddedDataSourceConfiguration.class)
    protected static class EmbeddedDatabaseConfiguration {
    }

    @Configuration(proxyBeanMethods = false)
    @Conditional(PooledDataSourceCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import({ DataSourceConfiguration.Hikari.class,
              DataSourceConfiguration.Tomcat.class,
              DataSourceConfiguration.Dbcp2.class })
    protected static class PooledDataSourceConfiguration {
    }
}
```

常用的 `@Conditional` 条件注解：

| 条件注解 | 说明 |
|---------|------|
| @ConditionalOnClass | classpath 中存在指定类时生效 |
| @ConditionalOnMissingClass | classpath 中不存在指定类时生效 |
| @ConditionalOnBean | 容器中存在指定 Bean 时生效 |
| @ConditionalOnMissingBean | 容器中不存在指定 Bean 时生效 |
| @ConditionalOnProperty | 配置属性满足条件时生效 |
| @ConditionalOnWebApplication | Web 环境下生效 |
| @ConditionalOnExpression | SpEL 表达式为 true 时生效 |

⚠️ **注意**：Spring Boot 3.x 中自动配置类的注册文件从 `META-INF/spring.factories` 改为 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`。

**💡 加分项**

- 可以通过 `spring.boot.enableautoconfiguration=false` 完全关闭自动配置。
- 可以通过 `@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})` 排除特定的自动配置。
- 启动时加 `--debug` 参数可以查看自动配置报告（ConditionEvaluationReport），知道哪些配置生效了、哪些没有。
- 自动配置的精髓在于 `@ConditionalOnMissingBean`：如果你手动配置了某个 Bean，自动配置就不会覆盖它，这就是"约定优于配置"的体现。

---

### 22. @SpringBootApplication 注解做了什么？

**🎯 面试直答版**

`@SpringBootApplication` 是一个组合注解，等价于同时使用三个注解：`@SpringBootConfiguration`（标记为配置类，本质是 @Configuration）、`@EnableAutoConfiguration`（开启自动配置）、`@ComponentScan`（组件扫描，默认扫描当前包及子包）。

**📖 深度解析版**

```java
// @SpringBootApplication 的源码
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootConfiguration  // 1. 标记为配置类
@EnableAutoConfiguration  // 2. 开启自动配置
@ComponentScan(excludeFilters = {
    @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
    @Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class)
})  // 3. 组件扫描
public @interface SpringBootApplication {
    // ...
}
```

三个核心注解的职责：

```java
// 1. @SpringBootConfiguration -> @Configuration
// 说明主启动类本身就是一个配置类，可以定义 @Bean 方法
@SpringBootApplication
public class Application {
    @Bean  // 可以在这里定义 Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}

// 2. @EnableAutoConfiguration
// 核心：通过 AutoConfigurationImportSelector 加载自动配置类
// 读取 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports

// 3. @ComponentScan
// 默认扫描主启动类所在包及其子包
// 这就是为什么主启动类通常放在最外层包
```

⚠️ **易错点**：主启动类一定要放在最外层包（根包），否则子包中的组件可能扫描不到。

```
com.example
├── Application.java          // 主启动类放这里
├── controller/
│   └── UserController.java   // 能被扫描到
├── service/
│   └── UserService.java      // 能被扫描到
└── repository/
    └── UserRepository.java   // 能被扫描到
```

**💡 加分项**

- `@SpringBootApplication` 支持排除自动配置：`@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})`。
- 如果需要扫描其他包，可以用 `@SpringBootApplication(scanBasePackages = {"com.example", "com.other"})`。
- 了解 `@SpringBootConfiguration` 和 `@Configuration` 的区别：`@SpringBootConfiguration` 只是 `@Configuration` 的派生，限制一个应用只能有一个，用于标识主配置类。

---

### 23. Spring Boot Starter 是什么？工作原理？

**🎯 面试直答版**

Starter 是 Spring Boot 的依赖管理机制，本质上是一组预定义的 Maven/Gradle 依赖集合。引入一个 Starter 就等于引入了该功能所需的所有依赖，同时触发对应的自动配置。例如 `spring-boot-starter-web` 包含了 Spring MVC、Tomcat、Jackson 等依赖，并自动配置好 Web 环境。

**📖 深度解析版**

Starter 的组成结构：

```
spring-boot-starter-web
├── spring-boot-starter           // 基础 starter（spring-core、spring-context、日志等）
├── spring-web                    // Spring Web 核心
├── spring-webmvc                // Spring MVC
├── spring-boot-starter-tomcat   // 内嵌 Tomcat
│   └── tomcat-embed-core
├── spring-boot-starter-json     // JSON 处理
│   └── jackson-databind
└── ...
```

Starter 的工作流程：

```
1. 引入 Starter 依赖
   └── Maven/Gradle 自动拉取所有传递依赖

2. 依赖中包含 spring-boot-autoconfigure 模块
   └── 该模块中有对应的自动配置类

3. 自动配置类通过 @Conditional 判断条件
   └── classpath 中有了相关类，条件满足，配置生效

4. 自动注册相关的 Bean
   └── 无需手动配置
```

常用的官方 Starter：

| Starter | 功能 |
|---------|------|
| spring-boot-starter-web | Web 开发（Spring MVC + Tomcat） |
| spring-boot-starter-data-jpa | JPA 数据访问 |
| spring-boot-starter-data-redis | Redis 数据访问 |
| spring-boot-starter-security | 安全认证 |
| spring-boot-starter-test | 测试 |
| spring-boot-starter-actuator | 监控 |
| spring-boot-starter-validation | 参数校验 |
| spring-boot-starter-cache | 缓存 |

⚠️ **命名规范**：
- 官方 Starter：`spring-boot-starter-{name}`
- 第三方 Starter：`{name}-spring-boot-starter`

**💡 加分项**

- Starter 本身通常不包含代码，只是一个 pom.xml 聚合了依赖。真正的自动配置逻辑在 `spring-boot-autoconfigure` 模块中。
- 自定义 Starter 是展现你对 Spring Boot 理解深度的好方式（详见第 26/39 题）。

---

### 24. Spring Boot 的配置文件加载顺序是什么？

**🎯 面试直答版**

Spring Boot 配置文件的加载优先级从高到低：命令行参数 > 操作系统环境变量 > JVM 系统属性 > application-{profile}.yml > application.yml。同时，外部配置优先于 jar 包内部配置，profile-specific 配置优先于通用配置。

**📖 深度解析版**

配置属性的优先级（从高到低，高优先级覆盖低优先级）：

```
1.  命令行参数（--server.port=8081）
2.  SPRING_APPLICATION_JSON 中的属性
3.  Java 系统属性（-Dserver.port=8081）
4.  操作系统环境变量（SERVER_PORT=8081）
5.  random.* 属性
6.  jar 包外部的 application-{profile}.yml
7.  jar 包内部的 application-{profile}.yml
8.  jar 包外部的 application.yml
9.  jar 包内部的 application.yml
10. @PropertySource 注解
11. SpringApplication.setDefaultProperties() 设置的默认值
```

配置文件的搜索路径（从高到低）：

```
1. file:./config/               # 项目根目录的 config 子目录
2. file:./config/*/             # 项目根目录的 config 子目录下的直接子目录
3. file:./                      # 项目根目录
4. classpath:/config/           # classpath 下的 config 目录
5. classpath:/                  # classpath 根目录
```

```yaml
# application.yml（通用配置）
server:
  port: 8080

spring:
  profiles:
    active: dev  # 激活 dev 环境

---

# application-dev.yml（开发环境）
server:
  port: 8081

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/dev_db

---

# application-prod.yml（生产环境）
server:
  port: 80

spring:
  datasource:
    url: jdbc:mysql://prod-server:3306/prod_db
```

```bash
# 命令行参数覆盖配置（优先级最高）
java -jar app.jar --server.port=9090

# 环境变量覆盖配置（注意命名规则：大写 + 下划线）
export SERVER_PORT=9090
export SPRING_DATASOURCE_URL=jdbc:mysql://xxx

# 激活不同的 profile
java -jar app.jar --spring.profiles.active=prod
```

**💡 加分项**

- Spring Boot 2.4+ 支持 `spring.config.import` 来导入额外配置文件，支持从文件系统、classpath、甚至 Kubernetes ConfigMap 导入。
- `.properties` 和 `.yml` 同时存在时，`.properties` 优先级更高。
- 实际生产中，敏感配置（数据库密码等）通常通过环境变量或配置中心（如 Nacos）注入，不会写在配置文件中。

---

### 25. SpringApplication.run() 做了什么？

**🎯 面试直答版**

`SpringApplication.run()` 是 Spring Boot 应用的启动入口，主要做了以下事情：创建 SpringApplication 实例、推断应用类型（Servlet/Reactive/None）、加载 SpringFactories、创建并刷新 ApplicationContext、启动内嵌 Web 服务器、执行 Runner（CommandLineRunner/ApplicationRunner）、发布各阶段事件。

**📖 深度解析版**

启动流程详解：

```
SpringApplication.run(Application.class, args)
│
├── 1. 创建 SpringApplication 实例
│   ├── 推断应用类型（SERVLET / REACTIVE / NONE）
│   ├── 加载 ApplicationContextInitializer
│   ├── 加载 ApplicationListener
│   └── 推断主启动类
│
├── 2. 运行 run() 方法
│   ├── 创建 BootstrapContext
│   ├── 获取并启动 SpringApplicationRunListeners
│   │   └── 发布 ApplicationStartingEvent
│   │
│   ├── 准备 Environment
│   │   ├── 创建 ConfigurableEnvironment
│   │   ├── 加载配置文件（application.yml 等）
│   │   └── 发布 ApplicationEnvironmentPreparedEvent
│   │
│   ├── 创建 ApplicationContext
│   │   ├── 根据应用类型选择实现类
│   │   │   ├── SERVLET -> AnnotationConfigServletWebServerApplicationContext
│   │   │   ├── REACTIVE -> AnnotationConfigReactiveWebServerApplicationContext
│   │   │   └── NONE -> AnnotationConfigApplicationContext
│   │   └── 发布 ApplicationContextInitializedEvent
│   │
│   ├── 准备 ApplicationContext
│   │   ├── 设置 Environment
│   │   ├── 注册 BeanDefinition（主配置类）
│   │   ├── 执行 ApplicationContextInitializer
│   │   └── 发布 ApplicationPreparedEvent
│   │
│   ├── 刷新 ApplicationContext（核心！）
│   │   ├── invokeBeanFactoryPostProcessors()
│   │   │   ├── 处理 @ComponentScan -> 扫描注册 Bean
│   │   │   ├── 处理 @Import -> 导入配置类（包括自动配置）
│   │   │   └── 处理 @Bean -> 注册 Bean 定义
│   │   ├── registerBeanPostProcessors()
│   │   ├── initMessageSource()
│   │   ├── initApplicationEventMulticaster()
│   │   ├── onRefresh()
│   │   │   └── 创建并启动内嵌 Web 服务器（Tomcat）
│   │   ├── finishBeanFactoryInitialization()
│   │   │   └── 实例化所有非懒加载的单例 Bean
│   │   └── finishRefresh()
│   │       └── 发布 ContextRefreshedEvent
│   │
│   ├── 发布 ApplicationStartedEvent
│   │
│   ├── 执行 Runner
│   │   ├── ApplicationRunner.run()
│   │   └── CommandLineRunner.run()
│   │
│   └── 发布 ApplicationReadyEvent
│
└── 返回 ConfigurableApplicationContext
```

```java
// 自定义 ApplicationRunner
@Component
public class MyRunner implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) {
        System.out.println("应用启动完成，执行初始化操作...");
    }
}

// 自定义 CommandLineRunner
@Component
@Order(1) // 控制执行顺序
public class DataInitRunner implements CommandLineRunner {
    @Override
    public void run(String... args) {
        System.out.println("初始化基础数据...");
    }
}
```

**💡 加分项**

- 面试中重点关注 `refresh()` 方法，这是 Spring 容器的核心启动逻辑，也是 Spring Framework 的代码（不是 Spring Boot 特有的）。
- 可以通过实现 `SpringApplicationRunListener` 来监听启动过程中的各个阶段。
- `ApplicationRunner` 和 `CommandLineRunner` 的区别：前者参数是 `ApplicationArguments`（解析后的参数），后者参数是原始的 `String[]`。

---

### 26. 如何自定义一个 Spring Boot Starter？

**🎯 面试直答版**

自定义 Starter 的步骤：1）创建 autoconfigure 模块，编写自动配置类并用 `@Conditional` 注解控制生效条件；2）创建 starter 模块，聚合依赖；3）在 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 中注册自动配置类；4）编写配置属性类（`@ConfigurationProperties`）支持外部配置。

**📖 深度解析版**

以自定义一个短信发送 Starter 为例：

```
sms-spring-boot-starter/            # starter 模块（只聚合依赖）
├── pom.xml
│
sms-spring-boot-autoconfigure/      # autoconfigure 模块（核心逻辑）
├── src/main/java/
│   └── com/example/sms/
│       ├── SmsProperties.java           # 配置属性
│       ├── SmsTemplate.java             # 核心功能类
│       └── SmsAutoConfiguration.java    # 自动配置类
├── src/main/resources/
│   └── META-INF/
│       └── spring/
│           └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
└── pom.xml
```

**Step 1：配置属性类**

```java
@ConfigurationProperties(prefix = "sms")
public class SmsProperties {
    private String accessKey;
    private String secretKey;
    private String signName;
    private String templateCode;

    // getter / setter
}
```

**Step 2：核心功能类**

```java
public class SmsTemplate {
    private final SmsProperties properties;

    public SmsTemplate(SmsProperties properties) {
        this.properties = properties;
    }

    public boolean send(String phone, Map<String, String> params) {
        // 调用短信服务商 API 发送短信
        System.out.println("发送短信到 " + phone + "，使用签名：" + properties.getSignName());
        return true;
    }
}
```

**Step 3：自动配置类**

```java
@AutoConfiguration
@ConditionalOnClass(SmsTemplate.class)
@ConditionalOnProperty(prefix = "sms", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(SmsProperties.class)
public class SmsAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public SmsTemplate smsTemplate(SmsProperties properties) {
        return new SmsTemplate(properties);
    }
}
```

**Step 4：注册自动配置类**

在 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 中：

```
com.example.sms.SmsAutoConfiguration
```

**Step 5：使用**

```yaml
# application.yml
sms:
  access-key: your-access-key
  secret-key: your-secret-key
  sign-name: 你的签名
  template-code: SMS_001
```

```java
@Service
public class NotificationService {
    @Autowired
    private SmsTemplate smsTemplate;

    public void sendVerificationCode(String phone, String code) {
        smsTemplate.send(phone, Map.of("code", code));
    }
}
```

**💡 加分项**

- 好的 Starter 应该提供合理的默认值，让用户零配置就能用起来（约定优于配置）。
- 可以通过 `spring-boot-configuration-processor` 依赖生成配置元数据，让 IDE 在编辑 yml 时有自动补全提示。
- `@ConditionalOnMissingBean` 是关键，它允许用户通过自定义 Bean 来覆盖默认行为。

---

### 27. Spring Boot 如何实现热部署？

**🎯 面试直答版**

Spring Boot 热部署主要通过 `spring-boot-devtools` 模块实现。它使用两个类加载器：一个加载不变的第三方 jar 包（Base ClassLoader），一个加载开发中频繁变化的项目类（Restart ClassLoader）。当代码修改后，只重新创建 Restart ClassLoader 并重新加载变化的类，达到快速重启的效果。

**📖 深度解析版**

```xml
<!-- 引入 devtools -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>
    <optional>true</optional>
</dependency>
```

devtools 的核心功能：

| 功能 | 说明 |
|------|------|
| 自动重启 | 检测到类文件变化时自动重启应用 |
| LiveReload | 资源文件变化时自动刷新浏览器 |
| 属性默认值 | 开发时禁用模板缓存等（方便调试） |
| 远程调试 | 支持远程应用的热部署 |

```yaml
# application.yml 配置
spring:
  devtools:
    restart:
      enabled: true
      # 额外监控的路径
      additional-paths: src/main/java
      # 排除不需要触发重启的路径
      exclude: static/**,public/**
    livereload:
      enabled: true
```

⚠️ **注意**：devtools 只能用于开发环境，打包为 jar 后自动禁用。它不是真正的"热更新"（HotSwap），而是"快速重启"。

**💡 加分项**

- 如果需要真正的热更新（不重启应用），可以使用 JRebel（商业产品）或 DCEVM（开源 JDK 增强）。
- IDEA 中需要开启自动编译（Build project automatically）和允许运行时自动构建（Advanced Settings -> Allow auto-make to start even if developed application is currently running），devtools 才能正常工作。
- 生产环境绝对不能使用 devtools。

---

## 五、Spring MVC 相关

### 28. Spring MVC 的请求处理流程是什么？（高频）

**🎯 面试直答版**

Spring MVC 的请求处理流程：1）客户端发送请求到 DispatcherServlet；2）DispatcherServlet 通过 HandlerMapping 找到对应的 Handler（Controller 方法）；3）通过 HandlerAdapter 执行 Handler；4）Handler 处理业务逻辑并返回 ModelAndView（或直接返回数据）；5）ViewResolver 解析视图；6）渲染视图并返回响应。在前后端分离架构中，通常使用 @ResponseBody 直接返回 JSON，不走视图解析。

**📖 深度解析版**

```
客户端请求
    │
    ▼
DispatcherServlet（前端控制器）
    │
    ├── 1. HandlerMapping（处理器映射器）
    │       └── 根据 URL 找到对应的 Handler（Controller 方法）
    │           返回 HandlerExecutionChain（Handler + 拦截器链）
    │
    ├── 2. HandlerAdapter（处理器适配器）
    │       ├── 参数解析（@RequestParam、@RequestBody、@PathVariable 等）
    │       ├── 执行 Handler（调用 Controller 方法）
    │       └── 返回值处理（@ResponseBody -> JSON 序列化）
    │
    ├── 3. 如果返回 ModelAndView:
    │       ├── ViewResolver（视图解析器）
    │       │       └── 解析逻辑视图名为实际 View 对象
    │       ├── View（视图）
    │       │       └── 渲染页面（Thymeleaf、JSP 等）
    │       └── 返回 HTML 响应
    │
    └── 3. 如果使用 @ResponseBody:
            ├── HttpMessageConverter（消息转换器）
            │       └── 将返回对象序列化为 JSON（Jackson）
            └── 直接写入 HTTP 响应体
```

核心组件的职责：

```java
// DispatcherServlet 核心处理逻辑（简化版）
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) {
    // 1. 通过 HandlerMapping 查找 Handler
    HandlerExecutionChain mappedHandler = getHandler(request);

    // 2. 获取 HandlerAdapter
    HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());

    // 3. 执行拦截器前置方法
    if (!mappedHandler.applyPreHandle(request, response)) {
        return;
    }

    // 4. 执行 Handler（Controller 方法）
    ModelAndView mv = ha.handle(request, response, mappedHandler.getHandler());

    // 5. 执行拦截器后置方法
    mappedHandler.applyPostHandle(request, response, mv);

    // 6. 视图渲染
    processDispatchResult(request, response, mappedHandler, mv, null);
}
```

```java
// Controller 示例
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    // 前后端分离：直接返回 JSON
    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        User user = userService.findById(id);
        return ResponseEntity.ok(user);
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody @Valid UserDTO dto) {
        User user = userService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }
}
```

**💡 加分项**

- 在前后端分离的主流架构下，ViewResolver 基本不再使用，返回值通过 `HttpMessageConverter`（默认使用 Jackson 的 `MappingJackson2HttpMessageConverter`）转换为 JSON。
- DispatcherServlet 本质是一个 Servlet，在 Spring Boot 中由 `DispatcherServletAutoConfiguration` 自动注册。
- HandlerMapping 有多种实现：`RequestMappingHandlerMapping`（处理 @RequestMapping）、`SimpleUrlHandlerMapping`（处理静态资源）等。

---

### 29. @Controller 和 @RestController 有什么区别？

**🎯 面试直答版**

`@RestController` = `@Controller` + `@ResponseBody`。`@Controller` 返回的是视图名称（需要视图解析器），`@RestController` 返回的数据会直接写入 HTTP 响应体（通常是 JSON）。前后端分离项目使用 `@RestController`，传统 MVC 项目使用 `@Controller`。

**📖 深度解析版**

```java
// @Controller：返回视图
@Controller
@RequestMapping("/web")
public class WebController {

    @GetMapping("/user")
    public String userPage(Model model) {
        model.addAttribute("users", userService.findAll());
        return "user/list"; // 返回视图名称，由 ViewResolver 解析
    }

    // 如果要返回 JSON，需要加 @ResponseBody
    @GetMapping("/api/user")
    @ResponseBody
    public List<User> getUsers() {
        return userService.findAll(); // 返回 JSON
    }
}

// @RestController：所有方法默认返回 JSON
@RestController
@RequestMapping("/api/users")
public class UserApiController {

    @GetMapping
    public List<User> getUsers() {
        return userService.findAll(); // 直接返回 JSON
    }

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id); // 直接返回 JSON
    }
}
```

```java
// @RestController 的源码
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Controller
@ResponseBody  // 关键：相当于给每个方法都加了 @ResponseBody
public @interface RestController {
    @AliasFor(annotation = Controller.class)
    String value() default "";
}
```

**💡 加分项**

- 在 `@RestController` 中如果某个方法需要返回视图，可以返回 `ModelAndView` 对象。
- `@ResponseBody` 的作用是告诉 Spring MVC 不要走视图解析，而是通过 `HttpMessageConverter` 将返回值直接写入响应体。

---

### 30. 拦截器（Interceptor）和过滤器（Filter）有什么区别？

**🎯 面试直答版**

Filter 是 Servlet 规范的一部分，作用于 Servlet 容器层面，对所有请求生效；Interceptor 是 Spring MVC 提供的，作用于 DispatcherServlet 层面，只对 Spring MVC 处理的请求生效。Filter 先执行，Interceptor 后执行。Interceptor 可以访问 Spring 容器中的 Bean，Filter 不能直接访问。

**📖 深度解析版**

| 对比维度 | Filter | Interceptor |
|---------|--------|-------------|
| 规范 | Servlet 规范 | Spring MVC |
| 作用范围 | 所有请求（包括静态资源） | 仅 Spring MVC 处理的请求 |
| 执行时机 | 在 DispatcherServlet 之前 | 在 DispatcherServlet 之后、Handler 之前 |
| 访问 Spring Bean | 不能直接注入 | 可以注入 Spring Bean |
| 执行方法 | doFilter() | preHandle() / postHandle() / afterCompletion() |

执行顺序：

```
客户端请求
  → Filter1.doFilter()
    → Filter2.doFilter()
      → DispatcherServlet
        → Interceptor1.preHandle()
          → Interceptor2.preHandle()
            → Controller 方法
          → Interceptor2.postHandle()
        → Interceptor1.postHandle()
        → 视图渲染
        → Interceptor2.afterCompletion()
      → Interceptor1.afterCompletion()
    → Filter2（后半段）
  → Filter1（后半段）
→ 响应返回客户端
```

```java
// Filter 示例
@Component
@Order(1)
public class RequestLogFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                        FilterChain chain) throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        System.out.println("Filter: " + req.getRequestURI());
        chain.doFilter(request, response); // 放行
    }
}

// Interceptor 示例
@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Autowired
    private TokenService tokenService; // 可以注入 Spring Bean

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                            Object handler) {
        String token = request.getHeader("Authorization");
        if (tokenService.validate(token)) {
            return true; // 放行
        }
        response.setStatus(401);
        return false; // 拦截
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response,
                          Object handler, ModelAndView modelAndView) {
        // Handler 执行后、视图渲染前
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                               Object handler, Exception ex) {
        // 请求完成后（视图渲染后），通常用于资源清理
    }
}

// 注册 Interceptor
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    @Autowired
    private AuthInterceptor authInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/login", "/api/register");
    }
}
```

**💡 加分项**

- Filter 更适合做通用的、与 Spring 无关的处理（如字符编码、CORS）；Interceptor 更适合做与业务相关的处理（如权限验证、日志记录）。
- 在 Spring Boot 中，可以通过 `@WebFilter` + `@ServletComponentScan` 或 `FilterRegistrationBean` 注册 Filter。

---

### 31. @RequestBody 和 @ResponseBody 的作用？

**🎯 面试直答版**

`@RequestBody` 将 HTTP 请求体中的 JSON 数据反序列化为 Java 对象。`@ResponseBody` 将方法返回的 Java 对象序列化为 JSON 写入 HTTP 响应体。两者都依赖 `HttpMessageConverter`（默认使用 Jackson）来进行 JSON 与对象之间的转换。

**📖 深度解析版**

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    // @RequestBody：将请求体中的 JSON 反序列化为 UserDTO 对象
    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody @Valid UserDTO dto) {
        // 请求体：{"name": "张三", "email": "zhangsan@example.com"}
        // dto.getName() -> "张三"
        // dto.getEmail() -> "zhangsan@example.com"
        User user = userService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    // @ResponseBody（@RestController 已包含）：将返回对象序列化为 JSON
    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
        // 返回的 User 对象会被 Jackson 序列化为 JSON：
        // {"id": 1, "name": "张三", "email": "zhangsan@example.com"}
    }
}
```

底层使用的 `HttpMessageConverter`：

| 转换器 | 功能 |
|-------|------|
| MappingJackson2HttpMessageConverter | JSON 转换（默认） |
| StringHttpMessageConverter | String 转换 |
| ByteArrayHttpMessageConverter | 字节数组转换 |
| FormHttpMessageConverter | 表单数据转换 |

⚠️ **易错点**：`@RequestBody` 接收的是请求体中的数据，对应 `Content-Type: application/json`。表单提交（`Content-Type: application/x-www-form-urlencoded`）不能用 `@RequestBody`，应该用 `@RequestParam` 或直接用对象接收。

**💡 加分项**

- 可以自定义 `HttpMessageConverter` 来支持其他数据格式（如 XML、Protocol Buffers）。
- `@RequestBody` 默认要求请求体不能为空，可以设置 `@RequestBody(required = false)` 允许为空。

---

### 32. Spring MVC 如何处理异常？

**🎯 面试直答版**

Spring MVC 异常处理有三种主要方式：1）`@ExceptionHandler` 在 Controller 内部处理特定异常；2）`@ControllerAdvice` + `@ExceptionHandler` 全局异常处理（最常用）；3）实现 `HandlerExceptionResolver` 接口自定义异常处理策略。实际开发中最推荐使用 `@ControllerAdvice` 做全局统一异常处理。

**📖 深度解析版**

```java
// 统一响应格式
public record ApiResponse<T>(int code, String message, T data) {
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "success", data);
    }

    public static ApiResponse<Void> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }
}

// 自定义业务异常
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    public int getCode() { return code; }
}

// 全局异常处理（推荐方式）
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 处理业务异常
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getCode(), e.getMessage()));
    }

    // 处理参数校验异常
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(
            MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(400, message));
    }

    // 处理 404
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFoundException(
            NoHandlerFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(404, "资源不存在"));
    }

    // 兜底：处理所有未捕获的异常
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("未知异常", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(500, "服务器内部错误"));
    }
}
```

**💡 加分项**

- `@ControllerAdvice` 可以通过 `basePackages` 或 `assignableTypes` 属性指定作用范围。
- Spring Boot 默认提供了 `BasicErrorController` 处理错误页面（/error），可以自定义替换它。
- 异常处理的优先级：Controller 内部的 `@ExceptionHandler` > `@ControllerAdvice` 中的 `@ExceptionHandler` > `HandlerExceptionResolver`。

---

### 33. @PathVariable、@RequestParam、@RequestBody 的区别？

**🎯 面试直答版**

`@PathVariable` 从 URL 路径中提取参数（/users/{id}）；`@RequestParam` 从查询参数或表单参数中提取（/users?name=xxx）；`@RequestBody` 从请求体中提取 JSON 数据。简单说：路径参数用 PathVariable，查询参数用 RequestParam，JSON 请求体用 RequestBody。

**📖 深度解析版**

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    // @PathVariable：从 URL 路径提取
    // GET /api/users/123
    @GetMapping("/{id}")
    public User getById(@PathVariable Long id) {
        return userService.findById(id);
    }

    // @RequestParam：从查询参数提取
    // GET /api/users?name=张三&page=1&size=10
    @GetMapping
    public Page<User> search(
            @RequestParam(required = false) String name,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return userService.search(name, page, size);
    }

    // @RequestBody：从请求体提取 JSON
    // POST /api/users
    // Body: {"name": "张三", "email": "zhangsan@example.com"}
    @PostMapping
    public User create(@RequestBody @Valid UserDTO dto) {
        return userService.create(dto);
    }

    // 组合使用
    // PUT /api/users/123?notify=true
    // Body: {"name": "李四"}
    @PutMapping("/{id}")
    public User update(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean notify,
            @RequestBody UserDTO dto) {
        User user = userService.update(id, dto);
        if (notify) {
            notificationService.sendUpdateNotification(user);
        }
        return user;
    }
}
```

| 注解 | 数据来源 | Content-Type | 使用场景 |
|------|---------|-------------|---------|
| @PathVariable | URL 路径 | 无关 | RESTful 中的资源标识 |
| @RequestParam | 查询字符串/表单 | 无关 / form-urlencoded | 搜索、分页、简单参数 |
| @RequestBody | 请求体 | application/json | 创建/更新资源 |

**💡 加分项**

- `@RequestParam` 接收的参数在 URL 中可见，不适合传递敏感信息。
- 一个请求中只能有一个 `@RequestBody`（请求体只有一个），但可以有多个 `@PathVariable` 和 `@RequestParam`。
- Spring MVC 还支持直接用 POJO 接收查询参数（不需要任何注解），Spring 会自动按属性名绑定。

---

## 六、事务相关

### 34. Spring 事务的实现原理？

**🎯 面试直答版**

Spring 事务基于 AOP 实现。当使用 `@Transactional` 注解时，Spring 会通过动态代理为目标方法创建代理对象。在代理方法中，Spring 通过 `PlatformTransactionManager`（如 `DataSourceTransactionManager`）来管理事务的开启、提交、回滚。底层依赖的是数据库连接的 `setAutoCommit(false)`、`commit()` 和 `rollback()`。

**📖 深度解析版**

事务执行的完整流程：

```
调用 @Transactional 方法
    │
    ▼
代理对象拦截（TransactionInterceptor）
    │
    ├── 1. 获取事务属性（@Transactional 的配置）
    │
    ├── 2. 获取 PlatformTransactionManager
    │
    ├── 3. 创建事务（AbstractPlatformTransactionManager#getTransaction）
    │   ├── 从数据源获取连接（DataSource.getConnection()）
    │   ├── 关闭自动提交（connection.setAutoCommit(false)）
    │   ├── 将连接绑定到 ThreadLocal（TransactionSynchronizationManager）
    │   └── 返回 TransactionStatus
    │
    ├── 4. 执行目标方法
    │
    ├── 5a. 正常返回 → 提交事务（connection.commit()）
    │
    └── 5b. 抛出异常 → 判断是否需要回滚
        ├── RuntimeException / Error → 回滚（connection.rollback()）
        └── 检查型异常 → 提交（默认不回滚！）
```

核心类关系：

```java
// 事务管理器接口
public interface PlatformTransactionManager {
    TransactionStatus getTransaction(TransactionDefinition definition);
    void commit(TransactionStatus status);
    void rollback(TransactionStatus status);
}

// JDBC 事务管理器
public class DataSourceTransactionManager extends AbstractPlatformTransactionManager {
    // 底层操作 JDBC Connection 的 commit / rollback
}

// JPA 事务管理器
public class JpaTransactionManager extends AbstractPlatformTransactionManager {
    // 底层操作 EntityManager 的事务
}
```

```java
// TransactionInterceptor 的简化逻辑
public Object invoke(MethodInvocation invocation) throws Throwable {
    TransactionInfo txInfo = createTransactionIfNecessary(tm, txAttr, methodName);
    Object retVal;
    try {
        retVal = invocation.proceed(); // 执行目标方法
    } catch (Throwable ex) {
        completeTransactionAfterThrowing(txInfo, ex); // 异常处理
        throw ex;
    }
    commitTransactionAfterReturning(txInfo); // 提交事务
    return retVal;
}
```

⚠️ **关键点**：Spring 事务通过 ThreadLocal 将数据库连接绑定到当前线程，确保同一事务中的多次数据库操作使用同一个连接。

**💡 加分项**

- Spring 事务的本质就是对 JDBC 事务的封装。如果理解了 JDBC 的 `setAutoCommit(false)` + `commit()` / `rollback()`，就理解了 Spring 事务的底层原理。
- 多数据源场景下，需要使用分布式事务（如 Seata）或手动管理事务。
- `@Transactional` 默认只对 RuntimeException 和 Error 回滚，对检查型异常（如 IOException）不回滚。这是最常见的踩坑点之一。

---

### 35. @Transactional 注解的属性有哪些？

**🎯 面试直答版**

`@Transactional` 的核心属性有：`propagation`（传播行为，默认 REQUIRED）、`isolation`（隔离级别，默认数据库默认级别）、`timeout`（超时时间）、`readOnly`（是否只读）、`rollbackFor`（指定哪些异常回滚）、`noRollbackFor`（指定哪些异常不回滚）、`transactionManager`（指定事务管理器）。

**📖 深度解析版**

```java
@Transactional(
    // 事务传播行为（默认 REQUIRED）
    propagation = Propagation.REQUIRED,

    // 隔离级别（默认跟随数据库）
    isolation = Isolation.DEFAULT,

    // 超时时间（秒），-1 表示不超时
    timeout = 30,

    // 是否只读（可以优化数据库性能）
    readOnly = false,

    // 指定哪些异常触发回滚
    rollbackFor = {BusinessException.class, IOException.class},

    // 指定哪些异常不触发回滚
    noRollbackFor = {MailSendException.class},

    // 指定事务管理器（多数据源时使用）
    transactionManager = "primaryTransactionManager"
)
public void createOrder(Order order) {
    // 业务逻辑
}
```

各属性详解：

| 属性 | 说明 | 默认值 |
|------|------|-------|
| propagation | 事务传播行为 | REQUIRED |
| isolation | 事务隔离级别 | DEFAULT（数据库默认） |
| timeout | 超时时间（秒） | -1（不超时） |
| readOnly | 是否只读 | false |
| rollbackFor | 触发回滚的异常类型 | RuntimeException, Error |
| noRollbackFor | 不触发回滚的异常类型 | 无 |
| transactionManager | 事务管理器名称 | 默认的 TransactionManager |

⚠️ **特别注意 rollbackFor**：

```java
// 默认只对 RuntimeException 和 Error 回滚
@Transactional
public void method1() throws IOException {
    // 抛出 IOException（检查型异常）不会回滚！
    throw new IOException("文件操作失败");
}

// 正确做法：显式指定 rollbackFor
@Transactional(rollbackFor = Exception.class)
public void method2() throws IOException {
    // 现在所有异常都会回滚
    throw new IOException("文件操作失败");
}
```

**💡 加分项**

- 建议在公司开发规范中要求所有 `@Transactional` 都加上 `rollbackFor = Exception.class`，避免检查型异常不回滚的坑。
- `readOnly = true` 可以让数据库进行查询优化（比如 MySQL 不加锁、不生成 undo log），在纯查询方法上加这个属性有性能收益。
- `timeout` 只在事务创建时生效，如果方法执行到一半超时了，并不会立即中断，而是在下一次数据库操作时检查并抛出异常。

---

### 36. 事务的传播行为有哪些？分别什么含义？（高频）

**🎯 面试直答版**

Spring 定义了 7 种事务传播行为，最常用的三种是：`REQUIRED`（默认，有事务就加入，没有就新建）、`REQUIRES_NEW`（总是新建事务，挂起当前事务）、`NESTED`（在当前事务中创建保存点，失败只回滚到保存点）。

**📖 深度解析版**

| 传播行为 | 说明 | 使用场景 |
|---------|------|---------|
| REQUIRED（默认） | 当前有事务则加入，没有则新建 | 大部分场景 |
| REQUIRES_NEW | 总是新建事务，挂起当前事务 | 独立操作（如日志记录） |
| NESTED | 在当前事务中创建保存点 | 部分失败可回滚的子操作 |
| SUPPORTS | 当前有事务则加入，没有则非事务执行 | 查询方法 |
| NOT_SUPPORTED | 非事务执行，挂起当前事务 | 不需要事务的操作 |
| MANDATORY | 必须在事务中执行，否则抛异常 | 强制要求事务的方法 |
| NEVER | 必须非事务执行，有事务则抛异常 | 不允许在事务中执行的方法 |

重点对比 REQUIRED、REQUIRES_NEW、NESTED：

```java
@Service
public class OrderService {

    @Autowired
    private OrderLogService orderLogService;

    // 外层事务
    @Transactional
    public void createOrder(Order order) {
        // 保存订单
        orderMapper.insert(order);

        // 记录操作日志
        try {
            orderLogService.saveLog(order);
        } catch (Exception e) {
            // 日志失败不影响主流程
        }
    }
}

@Service
public class OrderLogService {

    // REQUIRED（默认）：和 createOrder 在同一个事务中
    // 日志失败 → 整个事务回滚 → 订单也没了
    @Transactional(propagation = Propagation.REQUIRED)
    public void saveLog_required(Order order) { }

    // REQUIRES_NEW：在独立的新事务中执行
    // 日志失败 → 只有日志事务回滚 → 订单不受影响
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveLog_requiresNew(Order order) { }

    // NESTED：在当前事务的保存点中执行
    // 日志失败 → 回滚到保存点 → 订单不受影响
    // 但如果外层事务失败 → 日志也会回滚
    @Transactional(propagation = Propagation.NESTED)
    public void saveLog_nested(Order order) { }
}
```

REQUIRES_NEW 和 NESTED 的区别：

| 维度 | REQUIRES_NEW | NESTED |
|------|-------------|--------|
| 事务独立性 | 完全独立的新事务 | 外层事务的子事务（保存点） |
| 外层回滚 | 不影响内层（已提交） | 内层也回滚 |
| 内层回滚 | 不影响外层 | 不影响外层（回滚到保存点） |
| 连接 | 使用新的数据库连接 | 使用同一个数据库连接 |

⚠️ **高频易错**：NESTED 在 JPA/Hibernate 中默认不支持（不支持保存点），通常只在 JDBC/MyBatis 中有效。

**💡 加分项**

- 面试中被问到传播行为，重点讲清楚 REQUIRED、REQUIRES_NEW、NESTED 三个就足够了。
- 一个常见的面试追问："A 方法调用 B 方法，A 有事务 B 没有事务，B 抛了异常，A 的事务会回滚吗？"答案是会的，因为 B 的 REQUIRED 传播行为让它加入了 A 的事务。

---

### 37. 哪些情况下 @Transactional 会失效？（高频难题）

**🎯 面试直答版**

`@Transactional` 失效的常见场景：1）自调用（同类中 this 调用）；2）方法不是 public 的；3）异常被 catch 吞掉了；4）抛出的是检查型异常（默认不回滚）；5）数据库引擎不支持事务（如 MyISAM）；6）Bean 未被 Spring 管理；7）多线程调用（事务绑定在 ThreadLocal）。

**📖 深度解析版**

**场景 1：自调用（最常见的坑）**

```java
@Service
public class OrderService {

    public void createOrder(Order order) {
        // this 调用，不走代理，事务不生效！
        this.saveOrder(order);
    }

    @Transactional
    public void saveOrder(Order order) {
        orderMapper.insert(order);
        // 这里的事务不会生效
    }
}
```

**场景 2：方法非 public**

```java
@Service
public class OrderService {

    // 事务不生效！Spring 事务要求方法是 public 的
    @Transactional
    protected void saveOrder(Order order) {
        orderMapper.insert(order);
    }

    // private 更不行
    @Transactional
    private void saveOrderPrivate(Order order) {
        orderMapper.insert(order);
    }
}
```

**场景 3：异常被 catch 吞掉**

```java
@Service
public class OrderService {

    @Transactional
    public void createOrder(Order order) {
        try {
            orderMapper.insert(order);
            payService.pay(order); // 这里抛异常了
        } catch (Exception e) {
            log.error("支付失败", e);
            // 异常被吞掉了！Spring 不知道发生了异常，不会回滚！
        }
    }

    // 正确做法：catch 后重新抛出，或者手动回滚
    @Transactional
    public void createOrderCorrect(Order order) {
        try {
            orderMapper.insert(order);
            payService.pay(order);
        } catch (Exception e) {
            log.error("支付失败", e);
            // 方式1：重新抛出
            throw new BusinessException("下单失败");
            // 方式2：手动标记回滚
            // TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        }
    }
}
```

**场景 4：抛出检查型异常**

```java
@Service
public class OrderService {

    // 默认只对 RuntimeException 回滚，IOException 不回滚！
    @Transactional
    public void createOrder(Order order) throws IOException {
        orderMapper.insert(order);
        throw new IOException("文件处理失败"); // 不会回滚！
    }

    // 正确做法
    @Transactional(rollbackFor = Exception.class)
    public void createOrderCorrect(Order order) throws IOException {
        orderMapper.insert(order);
        throw new IOException("文件处理失败"); // 会回滚
    }
}
```

**场景 5：多线程**

```java
@Service
public class OrderService {

    @Transactional
    public void createOrder(Order order) {
        orderMapper.insert(order);

        // 新线程中的操作不在当前事务中！
        new Thread(() -> {
            // 这里有自己的线程，拿不到外层事务的数据库连接
            itemService.deductStock(order.getItems());
        }).start();
    }
}
```

⚠️ **失效场景汇总**：

| 场景 | 原因 | 解决方案 |
|------|------|---------|
| 自调用 | 绕过代理 | 注入自身 / AopContext |
| 非 public 方法 | Spring 事务限制 | 改为 public |
| 异常被 catch | Spring 不知道异常 | 重新抛出 / 手动回滚 |
| 检查型异常 | 默认不回滚 | rollbackFor = Exception.class |
| 数据库不支持 | MyISAM 无事务 | 使用 InnoDB |
| 多线程 | ThreadLocal 隔离 | 在同一线程内操作 |
| Bean 未被管理 | 不是代理对象 | 从容器获取 Bean |
| final 方法 | CGLIB 无法代理 | 去掉 final |
| propagation=NOT_SUPPORTED | 配置了不支持事务 | 检查传播行为配置 |

**💡 加分项**

- 实际项目中，最常踩的坑就是"自调用"和"异常被 catch"。建议代码审查时重点关注这两个场景。
- 可以通过 Spring 的事件机制（`@TransactionalEventListener`）在事务提交后执行异步操作，避免多线程事务问题。

---

### 38. 编程式事务和声明式事务的区别？

**🎯 面试直答版**

声明式事务通过 `@Transactional` 注解声明，基于 AOP 代理实现，对业务代码无侵入，是最常用的方式。编程式事务通过 `TransactionTemplate` 或 `PlatformTransactionManager` 在代码中手动管理事务，更灵活但代码侵入性强。声明式事务适合大部分场景，编程式事务适合需要精细控制的场景。

**📖 深度解析版**

```java
// 声明式事务（推荐，最常用）
@Service
public class OrderService {

    @Transactional(rollbackFor = Exception.class)
    public void createOrder(Order order) {
        orderMapper.insert(order);
        stockService.deduct(order.getItems());
        // 方法结束自动提交，异常自动回滚
    }
}

// 编程式事务方式1：TransactionTemplate（推荐的编程式方式）
@Service
public class OrderService {

    @Autowired
    private TransactionTemplate transactionTemplate;

    public void createOrder(Order order) {
        // 有返回值
        Order result = transactionTemplate.execute(status -> {
            try {
                orderMapper.insert(order);
                stockService.deduct(order.getItems());
                return order;
            } catch (Exception e) {
                status.setRollbackOnly(); // 手动标记回滚
                throw e;
            }
        });

        // 无返回值
        transactionTemplate.executeWithoutResult(status -> {
            orderMapper.insert(order);
            stockService.deduct(order.getItems());
        });
    }
}

// 编程式事务方式2：PlatformTransactionManager（最底层）
@Service
public class OrderService {

    @Autowired
    private PlatformTransactionManager transactionManager;

    public void createOrder(Order order) {
        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);

        TransactionStatus status = transactionManager.getTransaction(def);
        try {
            orderMapper.insert(order);
            stockService.deduct(order.getItems());
            transactionManager.commit(status);
        } catch (Exception e) {
            transactionManager.rollback(status);
            throw e;
        }
    }
}
```

| 对比 | 声明式事务 | 编程式事务 |
|------|----------|----------|
| 实现方式 | @Transactional 注解 | TransactionTemplate / TransactionManager |
| 代码侵入性 | 无侵入 | 有侵入 |
| 粒度 | 方法级别 | 代码块级别 |
| 灵活性 | 较低 | 较高 |
| 适用场景 | 大部分场景 | 一个方法中部分代码需要事务 |

**💡 加分项**

- 编程式事务的典型使用场景：一个方法中只有部分代码需要事务控制，或者需要在循环中每次迭代都独立事务。
- 实际项目中 95% 以上的场景用声明式事务就够了。编程式事务通常出现在框架代码中。
- 声明式事务和编程式事务可以混合使用。

---

## 七、场景设计类

### 39. 如何设计一个自定义的 Spring Boot Starter？

**🎯 面试直答版**

自定义 Starter 包含三个核心部分：1）配置属性类（`@ConfigurationProperties`）接收外部配置；2）自动配置类（`@AutoConfiguration` + `@Conditional` 条件注解）根据条件注册 Bean；3）在 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 中注册配置类。遵循命名规范：`{name}-spring-boot-starter`。

**📖 深度解析版**

以设计一个分布式锁 Starter 为例：

```java
// 1. 配置属性类
@ConfigurationProperties(prefix = "distributed-lock")
public class DistributedLockProperties {
    /** 锁类型：redis / zookeeper */
    private String type = "redis";
    /** 默认锁超时时间（秒） */
    private long timeout = 30;
    /** 默认等待时间（秒） */
    private long waitTime = 10;

    // getter / setter
}

// 2. 核心接口
public interface DistributedLock {
    boolean tryLock(String key, long waitTime, long timeout, TimeUnit unit);
    void unlock(String key);
}

// 3. Redis 实现
public class RedisDistributedLock implements DistributedLock {
    private final RedissonClient redissonClient;

    public RedisDistributedLock(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }

    @Override
    public boolean tryLock(String key, long waitTime, long timeout, TimeUnit unit) {
        RLock lock = redissonClient.getLock(key);
        try {
            return lock.tryLock(waitTime, timeout, unit);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    @Override
    public void unlock(String key) {
        RLock lock = redissonClient.getLock(key);
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
}

// 4. 自动配置类
@AutoConfiguration
@EnableConfigurationProperties(DistributedLockProperties.class)
@ConditionalOnProperty(prefix = "distributed-lock", name = "enabled", havingValue = "true",
                       matchIfMissing = true)
public class DistributedLockAutoConfiguration {

    @Bean
    @ConditionalOnClass(name = "org.redisson.api.RedissonClient")
    @ConditionalOnProperty(prefix = "distributed-lock", name = "type", havingValue = "redis",
                          matchIfMissing = true)
    @ConditionalOnMissingBean(DistributedLock.class)
    public DistributedLock redisDistributedLock(RedissonClient redissonClient) {
        return new RedisDistributedLock(redissonClient);
    }
}

// 5. 注册文件
// META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
// com.example.lock.DistributedLockAutoConfiguration
```

使用方：

```yaml
distributed-lock:
  type: redis
  timeout: 30
  wait-time: 10
```

```java
@Service
public class StockService {
    @Autowired
    private DistributedLock distributedLock;

    public void deductStock(Long productId, int quantity) {
        String lockKey = "stock:lock:" + productId;
        boolean locked = distributedLock.tryLock(lockKey, 10, 30, TimeUnit.SECONDS);
        if (!locked) {
            throw new BusinessException("获取锁失败");
        }
        try {
            // 扣减库存逻辑
        } finally {
            distributedLock.unlock(lockKey);
        }
    }
}
```

**💡 加分项**

- 好的 Starter 应该做到：合理的默认值、完善的条件判断（@ConditionalOnMissingBean 允许用户覆盖）、配置提示（spring-boot-configuration-processor）。
- 可以进一步提供 `@DistributedLock` 自定义注解，通过 AOP 切面实现声明式分布式锁，让使用更简单。

---

### 40. 在 Spring 项目中如何实现接口幂等性？

**🎯 面试直答版**

实现接口幂等性的常见方案：1）Token 机制（请求前获取 token，请求时携带 token，服务端验证并删除）；2）数据库唯一索引；3）乐观锁（版本号）；4）分布式锁；5）状态机（状态流转约束）。具体选择取决于业务场景，Token 机制最通用。

**📖 深度解析版**

**方案 1：Token 机制（最通用）**

```java
// 1. 生成 Token 的接口
@RestController
public class TokenController {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @GetMapping("/api/token")
    public String getToken() {
        String token = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set("idempotent:" + token, "1", 10, TimeUnit.MINUTES);
        return token;
    }
}

// 2. 自定义幂等注解
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Idempotent {
    /** Token 的请求头名称 */
    String headerName() default "Idempotent-Token";
    /** 提示信息 */
    String message() default "请勿重复提交";
}

// 3. AOP 切面校验 Token
@Aspect
@Component
public class IdempotentAspect {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Around("@annotation(idempotent)")
    public Object around(ProceedingJoinPoint pjp, Idempotent idempotent) throws Throwable {
        HttpServletRequest request =
            ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();

        String token = request.getHeader(idempotent.headerName());
        if (StringUtils.isBlank(token)) {
            throw new BusinessException("缺少幂等 Token");
        }

        // 使用 Redis 的 delete 命令原子性删除，返回是否成功
        Boolean deleted = redisTemplate.delete("idempotent:" + token);
        if (Boolean.FALSE.equals(deleted)) {
            throw new BusinessException(idempotent.message());
        }

        return pjp.proceed();
    }
}

// 4. 使用
@RestController
public class OrderController {

    @PostMapping("/api/orders")
    @Idempotent
    public Order createOrder(@RequestBody OrderDTO dto) {
        return orderService.createOrder(dto);
    }
}
```

**方案 2：数据库唯一索引**

```sql
-- 创建唯一索引
ALTER TABLE orders ADD UNIQUE INDEX uk_order_no (order_no);
```

```java
@Service
public class OrderService {
    @Transactional
    public void createOrder(OrderDTO dto) {
        try {
            orderMapper.insert(order); // 重复插入会抛异常
        } catch (DuplicateKeyException e) {
            log.warn("重复订单: {}", dto.getOrderNo());
            // 返回已存在的订单或忽略
        }
    }
}
```

**方案 3：乐观锁**

```java
// MyBatis 更新语句
@Update("UPDATE stock SET quantity = quantity - #{amount}, version = version + 1 " +
        "WHERE product_id = #{productId} AND version = #{version}")
int deductStock(@Param("productId") Long productId,
                @Param("amount") int amount,
                @Param("version") int version);
```

**💡 加分项**

- Token 机制适合前端页面防重复提交；数据库唯一索引适合业务上有唯一标识的场景；乐观锁适合更新操作；分布式锁适合需要串行化的场景。
- 生产环境中通常是多种方案组合使用，形成多层防御。

---

### 41. 如何在 Spring Boot 中实现统一异常处理？

**🎯 面试直答版**

使用 `@RestControllerAdvice` + `@ExceptionHandler` 实现全局统一异常处理。定义统一的响应格式（ApiResponse），然后针对不同类型的异常（业务异常、参数校验异常、系统异常等）分别编写处理方法，返回规范的错误响应。

**📖 深度解析版**

```java
// 1. 统一响应格式
public record ApiResponse<T>(
    int code,
    String message,
    T data,
    long timestamp
) {
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "success", data, System.currentTimeMillis());
    }

    public static ApiResponse<Void> error(int code, String message) {
        return new ApiResponse<>(code, message, null, System.currentTimeMillis());
    }
}

// 2. 自定义业务异常体系
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(String message) {
        this(400, message);
    }

    public int getCode() { return code; }
}

public class NotFoundException extends BusinessException {
    public NotFoundException(String message) {
        super(404, message);
    }
}

public class ForbiddenException extends BusinessException {
    public ForbiddenException(String message) {
        super(403, message);
    }
}

// 3. 全局异常处理器
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 业务异常 */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        log.warn("业务异常: {}", e.getMessage());
        return ResponseEntity.status(e.getCode())
                .body(ApiResponse.error(e.getCode(), e.getMessage()));
    }

    /** 参数校验异常 - @Valid 校验失败 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(
            MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败: {}", message);
        return ResponseEntity.badRequest().body(ApiResponse.error(400, message));
    }

    /** 参数校验异常 - @RequestParam 校验失败 */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolationException(
            ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining("; "));
        return ResponseEntity.badRequest().body(ApiResponse.error(400, message));
    }

    /** 请求方法不支持 */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotAllowed(
            HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.error(405, "请求方法不支持: " + e.getMethod()));
    }

    /** 兜底异常 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("系统异常", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(500, "服务器内部错误"));
    }
}
```

**💡 加分项**

- 生产环境的兜底异常处理不要把堆栈信息暴露给前端，只记录到日志。
- 可以使用 ErrorCode 枚举来统一管理错误码，避免硬编码。
- 可以通过 `@ControllerAdvice(basePackages = "com.example.api")` 限定作用范围。

---

### 42. 如何实现一个自定义注解来做接口限流？

**🎯 面试直答版**

实现步骤：1）定义 `@RateLimit` 自定义注解；2）编写 AOP 切面，在方法执行前检查限流条件；3）使用 Redis + Lua 脚本实现分布式限流（滑动窗口或令牌桶）。也可以使用 Guava 的 RateLimiter 做单机限流。

**📖 深度解析版**

```java
// 1. 自定义限流注解
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
    /** 限流 key 前缀 */
    String key() default "";
    /** 时间窗口内最大请求数 */
    int maxRequests() default 100;
    /** 时间窗口（秒） */
    int timeWindow() default 60;
    /** 限流维度：IP / USER / GLOBAL */
    LimitType type() default LimitType.IP;
}

public enum LimitType {
    IP, USER, GLOBAL
}

// 2. AOP 切面
@Aspect
@Component
@Slf4j
public class RateLimitAspect {

    @Autowired
    private StringRedisTemplate redisTemplate;

    // Lua 脚本：滑动窗口限流
    private static final String LUA_SCRIPT = """
        local key = KEYS[1]
        local maxRequests = tonumber(ARGV[1])
        local timeWindow = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        -- 移除窗口外的请求
        redis.call('ZREMRANGEBYSCORE', key, 0, now - timeWindow * 1000)
        -- 统计当前窗口内的请求数
        local count = redis.call('ZCARD', key)
        if count < maxRequests then
            redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
            redis.call('EXPIRE', key, timeWindow)
            return 1
        end
        return 0
        """;

    private final DefaultRedisScript<Long> redisScript;

    public RateLimitAspect() {
        redisScript = new DefaultRedisScript<>();
        redisScript.setScriptText(LUA_SCRIPT);
        redisScript.setResultType(Long.class);
    }

    @Around("@annotation(rateLimit)")
    public Object around(ProceedingJoinPoint pjp, RateLimit rateLimit) throws Throwable {
        String key = buildKey(rateLimit, pjp);

        Long result = redisTemplate.execute(
            redisScript,
            List.of(key),
            String.valueOf(rateLimit.maxRequests()),
            String.valueOf(rateLimit.timeWindow()),
            String.valueOf(System.currentTimeMillis())
        );

        if (result == null || result == 0L) {
            throw new BusinessException(429, "请求过于频繁，请稍后再试");
        }

        return pjp.proceed();
    }

    private String buildKey(RateLimit rateLimit, ProceedingJoinPoint pjp) {
        String prefix = StringUtils.hasText(rateLimit.key()) ?
            rateLimit.key() : pjp.getSignature().toShortString();

        return switch (rateLimit.type()) {
            case IP -> "rate_limit:" + prefix + ":" + getClientIp();
            case USER -> "rate_limit:" + prefix + ":" + getCurrentUserId();
            case GLOBAL -> "rate_limit:" + prefix;
        };
    }

    private String getClientIp() {
        HttpServletRequest request =
            ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();
        String ip = request.getHeader("X-Forwarded-For");
        return ip != null ? ip.split(",")[0].trim() : request.getRemoteAddr();
    }

    private String getCurrentUserId() {
        // 从 SecurityContext 或 ThreadLocal 获取当前用户 ID
        return "anonymous";
    }
}

// 3. 使用
@RestController
public class ApiController {

    @GetMapping("/api/sms/send")
    @RateLimit(key = "sms_send", maxRequests = 5, timeWindow = 60, type = LimitType.IP)
    public ApiResponse<Void> sendSms(@RequestParam String phone) {
        smsService.send(phone);
        return ApiResponse.success(null);
    }
}
```

**💡 加分项**

- Lua 脚本在 Redis 中是原子执行的，不需要额外的分布式锁，适合高并发场景。
- 生产环境可以使用 Sentinel 或 Resilience4j 等成熟框架来做限流，而不是自己造轮子。
- 限流算法有多种：固定窗口、滑动窗口、漏桶、令牌桶。滑动窗口适合大部分场景。

---

### 43. Spring Boot 项目如何优化启动速度？

**🎯 面试直答版**

优化 Spring Boot 启动速度的主要手段：1）排除不需要的自动配置类；2）使用懒加载（`spring.main.lazy-initialization=true`）；3）减少组件扫描范围；4）使用 Spring Boot 3.x 的 AOT 编译；5）使用 GraalVM 原生镜像；6）优化 Bean 的初始化逻辑。

**📖 深度解析版**

```yaml
# 1. 开启懒加载（非必要 Bean 延迟到首次使用时创建）
spring:
  main:
    lazy-initialization: true
# ⚠️ 注意：懒加载会导致首次请求变慢，且启动时无法发现配置错误
```

```java
// 2. 排除不需要的自动配置
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,        // 不需要数据库
    SecurityAutoConfiguration.class,          // 不需要安全
    RedisAutoConfiguration.class              // 不需要 Redis
})
public class Application { }

// 3. 缩小组件扫描范围
@SpringBootApplication
@ComponentScan(basePackages = "com.example.myapp") // 精确指定扫描范围
public class Application { }

// 4. 避免在 Bean 初始化时做耗时操作
@Component
public class DataInitializer {
    // 不推荐：在 @PostConstruct 中做耗时操作
    // @PostConstruct
    // public void init() { loadHugeData(); }

    // 推荐：使用 @Async 或 ApplicationRunner 异步初始化
}

// 5. 使用 @Indexed 加速组件扫描（Spring 5+）
// 在 pom.xml 中添加：
// <dependency>
//     <groupId>org.springframework</groupId>
//     <artifactId>spring-context-indexer</artifactId>
//     <optional>true</optional>
// </dependency>
// 编译时生成 META-INF/spring.components 索引文件，避免运行时 classpath 扫描
```

```xml
<!-- 6. Spring Boot 3.x AOT（Ahead-of-Time）编译 -->
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <executions>
        <execution>
            <id>process-aot</id>
            <goals>
                <goal>process-aot</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

优化效果对比：

| 优化手段 | 效果 | 风险 |
|---------|------|------|
| 排除自动配置 | 中等 | 低 |
| 懒加载 | 显著 | 首次请求慢，延迟发现问题 |
| 组件扫描索引 | 中等 | 低 |
| AOT 编译 | 显著 | 反射限制 |
| GraalVM 原生镜像 | 极大（毫秒级启动） | 生态兼容性问题 |

**💡 加分项**

- 可以通过启动日志中的 `Started Application in X seconds` 来衡量优化效果。
- `spring.main.lazy-initialization=true` 是全局懒加载。如果只想让特定 Bean 懒加载，使用 `@Lazy` 注解。
- GraalVM 原生镜像可以让 Spring Boot 应用在毫秒级启动，非常适合 Serverless 场景，但需要注意反射、动态代理等限制。

---

### 44. 如何实现 Spring Boot 的优雅停机？

**🎯 面试直答版**

Spring Boot 2.3+ 内置了优雅停机支持，只需配置 `server.shutdown=graceful`。优雅停机的含义是：收到停机信号后，不再接受新请求，等待已有请求处理完成（或超时），然后再关闭应用。还可以通过 `@PreDestroy`、`DisposableBean`、`SmartLifecycle` 等钩子执行清理逻辑。

**📖 深度解析版**

```yaml
# application.yml
server:
  shutdown: graceful  # 开启优雅停机（默认是 immediate）

spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s  # 优雅停机超时时间（默认 30s）
```

```java
// 自定义关闭前的清理逻辑
@Component
@Slf4j
public class GracefulShutdownHandler implements DisposableBean {

    @Override
    public void destroy() {
        log.info("正在执行清理逻辑...");
        // 关闭线程池、释放连接、清理临时文件等
    }
}

// 使用 @PreDestroy
@Component
@Slf4j
public class CacheCleanup {

    @PreDestroy
    public void cleanup() {
        log.info("清理缓存...");
    }
}

// 使用 SmartLifecycle 精细控制关闭顺序
@Component
@Slf4j
public class MessageConsumerLifecycle implements SmartLifecycle {

    private volatile boolean running = false;

    @Override
    public void start() {
        log.info("启动消息消费者");
        running = true;
    }

    @Override
    public void stop(Runnable callback) {
        log.info("停止消息消费者，等待消费完成...");
        // 停止接收新消息，处理完当前消息
        running = false;
        callback.run(); // 必须调用，通知 Spring 已完成
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public int getPhase() {
        return Integer.MAX_VALUE; // 最后启动，最先关闭
    }
}
```

优雅停机的流程：

```
收到 SIGTERM 信号（kill pid / Ctrl+C）
    │
    ├── 1. 停止接受新请求（返回 503）
    ├── 2. 等待正在处理的请求完成
    ├── 3. 执行 SmartLifecycle#stop()（按 phase 倒序）
    ├── 4. 执行 @PreDestroy / DisposableBean#destroy()
    ├── 5. 关闭 ApplicationContext
    └── 6. 关闭 JVM

    如果超过 timeout-per-shutdown-phase 还没处理完 → 强制关闭
```

**💡 加分项**

- 在 Kubernetes 环境中，优雅停机配合 `preStop` 钩子和 `readinessProbe` 使用，可以实现零停机部署。
- 优雅停机期间，如果有定时任务或消息消费者在运行，需要在 `SmartLifecycle#stop()` 中先停止它们。
- `kill -9` 是强制杀死进程，不会触发优雅停机。应该使用 `kill -15`（SIGTERM）。

---

### 45. 如何在 Spring 中实现多数据源切换？

**🎯 面试直答版**

实现多数据源切换的核心是 Spring 提供的 `AbstractRoutingDataSource`。通过继承它并重写 `determineCurrentLookupKey()` 方法，结合 ThreadLocal 保存当前数据源标识，再配合自定义注解和 AOP 切面实现动态切换。

**📖 深度解析版**

```java
// 1. 数据源枚举和 ThreadLocal 持有者
public class DataSourceContextHolder {

    private static final ThreadLocal<String> CONTEXT = new ThreadLocal<>();

    public static void set(String dataSource) {
        CONTEXT.set(dataSource);
    }

    public static String get() {
        return CONTEXT.get();
    }

    public static void clear() {
        CONTEXT.remove();
    }
}

// 2. 动态数据源路由
public class DynamicDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return DataSourceContextHolder.get();
    }
}

// 3. 自定义注解
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface DS {
    String value() default "master";
}

// 4. AOP 切面
@Aspect
@Component
@Order(-1) // 优先级要高于 @Transactional
public class DataSourceAspect {

    @Around("@annotation(ds)")
    public Object around(ProceedingJoinPoint pjp, DS ds) throws Throwable {
        String previousDs = DataSourceContextHolder.get();
        DataSourceContextHolder.set(ds.value());
        try {
            return pjp.proceed();
        } finally {
            if (previousDs != null) {
                DataSourceContextHolder.set(previousDs);
            } else {
                DataSourceContextHolder.clear();
            }
        }
    }
}

// 5. 数据源配置
@Configuration
public class DataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.master")
    public DataSource masterDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.slave")
    public DataSource slaveDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean
    @Primary
    public DataSource dynamicDataSource(
            @Qualifier("masterDataSource") DataSource master,
            @Qualifier("slaveDataSource") DataSource slave) {
        DynamicDataSource dynamic = new DynamicDataSource();
        Map<Object, Object> dataSources = new HashMap<>();
        dataSources.put("master", master);
        dataSources.put("slave", slave);
        dynamic.setTargetDataSources(dataSources);
        dynamic.setDefaultTargetDataSource(master);
        return dynamic;
    }
}

// 6. 使用
@Service
public class UserService {

    @DS("master")
    @Transactional
    public void createUser(User user) {
        userMapper.insert(user);
    }

    @DS("slave")
    public User findById(Long id) {
        return userMapper.selectById(id);
    }
}
```

```yaml
spring:
  datasource:
    master:
      url: jdbc:mysql://master-host:3306/db
      username: root
      password: root
    slave:
      url: jdbc:mysql://slave-host:3306/db
      username: root
      password: root
```

⚠️ **注意**：数据源切换的 AOP 切面优先级必须高于事务切面（`@Order(-1)`），否则事务已经拿到了数据源连接后才切换就没用了。

**💡 加分项**

- 生产环境推荐使用成熟的多数据源框架如 `dynamic-datasource-spring-boot-starter`（MyBatis-Plus 团队出品），它已经帮你处理好了各种边界情况。
- 读写分离场景下，可以结合 MyBatis 拦截器自动判断 SQL 类型（SELECT 走从库，INSERT/UPDATE/DELETE 走主库）。

---

### 46. 如何设计一个通用的操作日志记录方案？

**🎯 面试直答版**

使用自定义注解 `@OperationLog` + AOP 切面来实现通用操作日志记录。注解定义操作类型和描述，AOP 切面在方法执行前后记录操作人、请求参数、返回结果、执行时间等信息。日志可以异步写入数据库或消息队列，避免影响主流程性能。

**📖 深度解析版**

```java
// 1. 自定义注解
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface OperationLog {
    /** 模块 */
    String module() default "";
    /** 操作类型 */
    OperationType type() default OperationType.OTHER;
    /** 操作描述（支持 SpEL 表达式） */
    String description() default "";
}

public enum OperationType {
    CREATE, UPDATE, DELETE, QUERY, IMPORT, EXPORT, LOGIN, LOGOUT, OTHER
}

// 2. 日志实体
@Data
@TableName("sys_operation_log")
public class SysOperationLog {
    private Long id;
    private String module;
    private String type;
    private String description;
    private String method;
    private String requestUrl;
    private String requestMethod;
    private String requestParams;
    private String responseResult;
    private String operatorId;
    private String operatorName;
    private String ip;
    private Long costTime;
    private Integer status; // 0 成功 1 失败
    private String errorMsg;
    private LocalDateTime createTime;
}

// 3. AOP 切面
@Aspect
@Component
@Slf4j
public class OperationLogAspect {

    @Autowired
    private OperationLogService logService;

    @Around("@annotation(operationLog)")
    public Object around(ProceedingJoinPoint pjp, OperationLog operationLog) throws Throwable {
        SysOperationLog logEntity = new SysOperationLog();
        logEntity.setModule(operationLog.module());
        logEntity.setType(operationLog.type().name());
        logEntity.setDescription(parseDescription(operationLog.description(), pjp));
        logEntity.setMethod(pjp.getSignature().toShortString());
        logEntity.setRequestParams(getRequestParams(pjp));
        logEntity.setCreateTime(LocalDateTime.now());

        // 获取请求信息
        HttpServletRequest request = getRequest();
        if (request != null) {
            logEntity.setRequestUrl(request.getRequestURI());
            logEntity.setRequestMethod(request.getMethod());
            logEntity.setIp(getClientIp(request));
        }

        // 获取操作人信息（从 SecurityContext 或其他地方）
        logEntity.setOperatorId(getCurrentUserId());
        logEntity.setOperatorName(getCurrentUserName());

        long start = System.currentTimeMillis();
        try {
            Object result = pjp.proceed();
            logEntity.setStatus(0);
            logEntity.setResponseResult(toJsonString(result));
            return result;
        } catch (Throwable e) {
            logEntity.setStatus(1);
            logEntity.setErrorMsg(e.getMessage());
            throw e;
        } finally {
            logEntity.setCostTime(System.currentTimeMillis() - start);
            // 异步保存日志，不影响主流程
            logService.asyncSave(logEntity);
        }
    }

    /** 解析 SpEL 表达式 */
    private String parseDescription(String description, ProceedingJoinPoint pjp) {
        if (!description.contains("#")) {
            return description;
        }
        // 使用 SpEL 解析参数
        MethodSignature signature = (MethodSignature) pjp.getSignature();
        String[] paramNames = signature.getParameterNames();
        Object[] args = pjp.getArgs();
        StandardEvaluationContext context = new StandardEvaluationContext();
        for (int i = 0; i < paramNames.length; i++) {
            context.setVariable(paramNames[i], args[i]);
        }
        ExpressionParser parser = new SpelExpressionParser();
        return parser.parseExpression(description).getValue(context, String.class);
    }
}

// 4. 异步保存日志
@Service
public class OperationLogService {

    @Autowired
    private OperationLogMapper logMapper;

    @Async("logTaskExecutor")
    public void asyncSave(SysOperationLog log) {
        try {
            logMapper.insert(log);
        } catch (Exception e) {
            // 日志保存失败不能影响业务
            log.error("保存操作日志失败", e);
        }
    }
}

// 5. 使用
@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping
    @OperationLog(module = "用户管理", type = OperationType.CREATE,
                  description = "创建用户: #dto.name")
    public User createUser(@RequestBody UserDTO dto) {
        return userService.create(dto);
    }

    @DeleteMapping("/{id}")
    @OperationLog(module = "用户管理", type = OperationType.DELETE,
                  description = "删除用户: #id")
    public void deleteUser(@PathVariable Long id) {
        userService.delete(id);
    }
}
```

**💡 加分项**

- 日志描述支持 SpEL 表达式可以动态拼接参数值，让日志更有意义。
- 异步保存日志是关键，不能因为日志记录影响接口响应时间。推荐使用独立的线程池。
- 大流量场景下，可以先写入消息队列（Kafka），再异步消费入库，避免数据库压力。

---

## 八、Spring Boot 进阶

### 47. Spring Boot 内嵌 Tomcat 是如何工作的？

**🎯 面试直答版**

Spring Boot 通过 `ServletWebServerFactory`（如 `TomcatServletWebServerFactory`）在应用启动时创建和配置内嵌的 Tomcat 实例。在 `ApplicationContext` 的 `onRefresh()` 阶段，创建 Tomcat、配置 Connector（端口、协议）、创建 Context、注册 DispatcherServlet，然后启动 Tomcat。整个过程由 `ServletWebServerApplicationContext` 协调。

**📖 深度解析版**

启动流程：

```
SpringApplication.run()
    └── refreshContext()
            └── AbstractApplicationContext.refresh()
                    └── onRefresh()（由子类实现）
                            └── ServletWebServerApplicationContext.createWebServer()
                                    ├── 获取 ServletWebServerFactory Bean
                                    │   └── TomcatServletWebServerFactory（自动配置注册的）
                                    ├── 创建 WebServer
                                    │   ├── new Tomcat()
                                    │   ├── 配置 Connector（端口、协议）
                                    │   ├── 创建 Context
                                    │   ├── 注册 Servlet（DispatcherServlet）
                                    │   ├── 注册 Filter
                                    │   └── 注册 Listener
                                    └── webServer.start()
                                            └── Tomcat.start()
```

自动配置的关键类：

```java
// 1. ServletWebServerFactoryAutoConfiguration 注册 WebServerFactory
@AutoConfiguration
@ConditionalOnClass(ServletRequest.class)
@ConditionalOnWebApplication(type = Type.SERVLET)
@EnableConfigurationProperties(ServerProperties.class)
public class ServletWebServerFactoryAutoConfiguration {
    // 注册 TomcatServletWebServerFactory
}

// 2. 自定义 Tomcat 配置
@Component
public class TomcatCustomizer implements WebServerFactoryCustomizer<TomcatServletWebServerFactory> {
    @Override
    public void customize(TomcatServletWebServerFactory factory) {
        factory.setPort(8081);
        factory.addConnectorCustomizers(connector -> {
            connector.setMaxPostSize(10 * 1024 * 1024); // 最大 POST 大小 10MB
        });
    }
}
```

```yaml
# 常用 Tomcat 配置
server:
  port: 8080
  tomcat:
    max-threads: 200          # 最大工作线程数
    min-spare-threads: 10     # 最小空闲线程数
    max-connections: 8192     # 最大连接数
    accept-count: 100         # 等待队列长度
    connection-timeout: 20000 # 连接超时（毫秒）
```

⚠️ 切换内嵌服务器：

```xml
<!-- 排除 Tomcat，使用 Undertow -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-undertow</artifactId>
</dependency>
```

**💡 加分项**

- Spring Boot 支持三种内嵌服务器：Tomcat（默认）、Jetty、Undertow。Undertow 在高并发场景下性能较好。
- 如果需要部署到外部 Tomcat，需要将主启动类继承 `SpringBootServletInitializer` 并将打包方式改为 war。
- 内嵌 Tomcat 默认使用 NIO 模式（非阻塞 IO），可以通过配置切换到 APR 模式获得更好的性能（需要安装 apr 和 tomcat-native）。

---

### 48. Spring Boot 的 Actuator 有什么用？

**🎯 面试直答版**

Spring Boot Actuator 提供了一系列生产级监控和管理端点，包括健康检查（/health）、指标监控（/metrics）、环境信息（/env）、Bean 列表（/beans）、线程信息（/threaddump）等。它可以与 Prometheus + Grafana 集成实现可视化监控，是微服务可观测性的重要组成部分。

**📖 深度解析版**

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

```yaml
# 配置 Actuator
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,beans,threaddump,loggers,prometheus
      base-path: /actuator
  endpoint:
    health:
      show-details: always  # 显示详细健康信息
  metrics:
    export:
      prometheus:
        enabled: true        # 暴露 Prometheus 格式指标
```

常用端点：

| 端点 | 路径 | 说明 |
|------|------|------|
| health | /actuator/health | 健康检查（数据库、Redis、磁盘等） |
| info | /actuator/info | 应用信息 |
| metrics | /actuator/metrics | 指标（JVM、HTTP 请求、数据库连接池等） |
| env | /actuator/env | 环境变量和配置 |
| beans | /actuator/beans | 所有 Bean 列表 |
| threaddump | /actuator/threaddump | 线程快照 |
| loggers | /actuator/loggers | 日志级别（可动态修改） |
| prometheus | /actuator/prometheus | Prometheus 格式指标 |

```java
// 自定义健康检查
@Component
public class CustomHealthIndicator implements HealthIndicator {

    @Override
    public Health health() {
        // 检查外部依赖
        boolean externalServiceUp = checkExternalService();
        if (externalServiceUp) {
            return Health.up()
                    .withDetail("externalService", "可用")
                    .build();
        }
        return Health.down()
                .withDetail("externalService", "不可用")
                .build();
    }
}

// 自定义指标
@Service
public class OrderService {

    private final Counter orderCounter;
    private final Timer orderTimer;

    public OrderService(MeterRegistry registry) {
        this.orderCounter = Counter.builder("orders.created.total")
                .description("创建订单总数")
                .register(registry);
        this.orderTimer = Timer.builder("orders.create.duration")
                .description("创建订单耗时")
                .register(registry);
    }

    public Order createOrder(OrderDTO dto) {
        return orderTimer.record(() -> {
            Order order = doCreateOrder(dto);
            orderCounter.increment();
            return order;
        });
    }
}
```

**💡 加分项**

- 生产环境必须对 Actuator 端点做安全防护，可以通过 Spring Security 或只允许内网访问。
- 与 Prometheus + Grafana 集成是微服务监控的标准方案。Spring Boot 3.x 还支持 Micrometer Tracing（分布式链路追踪）。
- 动态修改日志级别在线上排查问题时非常有用：`POST /actuator/loggers/com.example -d '{"configuredLevel": "DEBUG"}'`。

---

### 49. Spring Boot 3.x 相比 2.x 有哪些重要变化？

**🎯 面试直答版**

Spring Boot 3.x 的核心变化：1）要求 Java 17+ 最低版本；2）从 Java EE 迁移到 Jakarta EE（javax.* -> jakarta.*）；3）支持 GraalVM 原生镜像（AOT 编译）；4）新的自动配置注册方式（AutoConfiguration.imports 替代 spring.factories）；5）Micrometer Observation API 统一可观测性。

**📖 深度解析版**

| 变化项 | Spring Boot 2.x | Spring Boot 3.x |
|-------|----------------|----------------|
| Java 版本 | Java 8+ | Java 17+ |
| Java EE | javax.* | Jakarta EE 9+（jakarta.*） |
| 原生镜像 | 不支持（或实验性） | 官方支持 GraalVM |
| 自动配置注册 | META-INF/spring.factories | META-INF/spring/AutoConfiguration.imports |
| 可观测性 | Micrometer Metrics | Micrometer Observation（统一 Metrics + Tracing） |
| HTTP Client | RestTemplate | 推荐 RestClient / WebClient |
| 安全框架 | Spring Security 5.x | Spring Security 6.x |

**最大的影响：Jakarta EE 迁移**

```java
// Spring Boot 2.x
import javax.servlet.http.HttpServletRequest;
import javax.persistence.Entity;
import javax.validation.constraints.NotNull;

// Spring Boot 3.x
import jakarta.servlet.http.HttpServletRequest;
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotNull;
```

⚠️ 升级时需要全局替换 `javax.` 为 `jakarta.`，并检查所有第三方依赖是否支持 Jakarta EE。

**GraalVM 原生镜像支持：**

```bash
# 构建原生镜像
mvn -Pnative native:compile

# 或使用 Buildpacks
mvn -Pnative spring-boot:build-image
```

原生镜像的优势：
- 启动时间：从秒级降到毫秒级
- 内存占用：大幅减少
- 适合 Serverless、云函数等场景

原生镜像的限制：
- 不支持运行时反射（需要预先声明）
- 不支持动态代理（需要 AOT 处理）
- 部分第三方库不兼容

**新的自动配置注册方式：**

```
# 2.x: META-INF/spring.factories
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.MyAutoConfiguration

# 3.x: META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.example.MyAutoConfiguration
```

**💡 加分项**

- 升级到 3.x 最大的工作量在于 Jakarta EE 迁移和第三方依赖兼容性检查。Spring 官方提供了 `spring-boot-migrator` 工具辅助迁移。
- Java 17 带来了 Records、Sealed Classes、Pattern Matching 等语言特性，可以让 Spring Boot 3.x 的代码更简洁。
- Micrometer Observation API 统一了 Metrics 和 Tracing 的编程模型，不再需要分别对接不同的系统。

---

### 50. Spring Boot 中如何实现异步处理？

**🎯 面试直答版**

Spring Boot 实现异步处理主要有三种方式：1）使用 `@Async` 注解 + `@EnableAsync` 开启异步；2）使用 `CompletableFuture` 手动管理异步任务；3）使用自定义线程池执行异步任务。`@Async` 最简单，底层基于 AOP 创建代理对象，在新线程中执行方法。

**📖 深度解析版**

**方式 1：@Async 注解**

```java
// 1. 开启异步支持
@Configuration
@EnableAsync
public class AsyncConfig {

    // 自定义线程池（强烈推荐，不要用默认的）
    @Bean("taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(200);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }
}

// 2. 使用 @Async
@Service
@Slf4j
public class NotificationService {

    // 无返回值的异步方法
    @Async("taskExecutor")
    public void sendEmail(String to, String subject, String content) {
        log.info("发送邮件到 {} ...", to);
        // 模拟耗时操作
        emailClient.send(to, subject, content);
    }

    // 有返回值的异步方法
    @Async("taskExecutor")
    public CompletableFuture<Boolean> sendSms(String phone, String message) {
        log.info("发送短信到 {} ...", phone);
        boolean result = smsClient.send(phone, message);
        return CompletableFuture.completedFuture(result);
    }
}

// 3. 调用异步方法
@Service
public class OrderService {

    @Autowired
    private NotificationService notificationService;

    public void createOrder(Order order) {
        // 保存订单（同步）
        orderMapper.insert(order);

        // 发送通知（异步，不阻塞当前线程）
        notificationService.sendEmail(order.getEmail(), "订单确认", "...");

        // 如果需要获取异步结果
        CompletableFuture<Boolean> smsFuture =
            notificationService.sendSms(order.getPhone(), "您的订单已创建");

        // 后续可以通过 smsFuture.get() 获取结果（但这样就阻塞了）
    }
}
```

⚠️ **@Async 的常见坑**：

```java
// 坑1：自调用不生效（和 @Transactional 一样）
@Service
public class MyService {
    public void methodA() {
        this.methodB(); // @Async 不生效！
    }

    @Async
    public void methodB() { }
}

// 坑2：没有自定义线程池
// 默认使用 SimpleAsyncTaskExecutor，它不复用线程，每次创建新线程！
// 生产环境必须自定义线程池

// 坑3：异常被吞掉
// 无返回值的 @Async 方法抛出的异常默认不会被捕获
// 需要实现 AsyncUncaughtExceptionHandler
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (throwable, method, params) -> {
            log.error("异步方法 {} 异常: {}", method.getName(), throwable.getMessage());
        };
    }
}
```

**方式 2：CompletableFuture 组合多个异步任务**

```java
@Service
public class DashboardService {

    @Autowired
    private UserService userService;
    @Autowired
    private OrderService orderService;
    @Autowired
    private StatisticsService statisticsService;

    public DashboardData getDashboardData(Long userId) {
        // 并行执行三个查询
        CompletableFuture<User> userFuture =
            CompletableFuture.supplyAsync(() -> userService.findById(userId));
        CompletableFuture<List<Order>> ordersFuture =
            CompletableFuture.supplyAsync(() -> orderService.findByUserId(userId));
        CompletableFuture<Statistics> statsFuture =
            CompletableFuture.supplyAsync(() -> statisticsService.getStats(userId));

        // 等待所有任务完成
        CompletableFuture.allOf(userFuture, ordersFuture, statsFuture).join();

        // 组装结果
        return new DashboardData(
            userFuture.join(),
            ordersFuture.join(),
            statsFuture.join()
        );
    }
}
```

**💡 加分项**

- `@Async` 的默认线程池是 `SimpleAsyncTaskExecutor`，它不复用线程，这在生产环境是灾难性的。**一定要自定义线程池**。
- Spring Boot 3.x 中推荐使用虚拟线程（Virtual Threads，Java 21+）来处理异步任务，配置 `spring.threads.virtual.enabled=true` 即可。
- 在分布式系统中，异步处理更适合使用消息队列（RabbitMQ、Kafka）来实现，而不是线程池，因为消息队列可以保证消息不丢失。

---

## 附录：高频面试题 TOP 10 速查

| 排名 | 题目 | 对应编号 |
|------|------|---------|
| 1 | Spring Bean 的生命周期 | #8 |
| 2 | Spring Boot 自动配置原理 | #21 |
| 3 | Spring 循环依赖与三级缓存 | #11 |
| 4 | Spring MVC 请求处理流程 | #28 |
| 5 | @Transactional 失效场景 | #37 |
| 6 | 事务传播行为 | #36 |
| 7 | AOP 实现原理与失效场景 | #16, #20 |
| 8 | JDK 动态代理 vs CGLIB | #17 |
| 9 | SpringApplication.run() 启动流程 | #25 |
| 10 | Spring 事务实现原理 | #34 |

---

> 最后更新：2026-04
> 适用版本：Spring Boot 3.x + Java 17+
