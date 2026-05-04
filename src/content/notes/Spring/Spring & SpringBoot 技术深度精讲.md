# Spring & Spring Boot 技术深度精讲

> 面向 Java 后端开发者 | 基于 Spring Boot 3.x + Java 17 | 由浅入深，系统精讲

---

## 一、IoC 与 DI：Spring 的灵魂

### 1.1 什么是 IoC（控制反转）

**通俗类比：**

想象你去餐厅吃饭。传统方式是你自己去菜市场买菜、自己洗菜、自己炒菜（对象自己创建依赖）。而 IoC 的方式是：你只需要坐在餐厅里，告诉服务员你要什么菜，厨房（Spring 容器）就会帮你做好端上来。

**你不再主动"做菜"（创建对象），而是被动"等菜"（容器注入对象）。控制权从"你"转移到了"餐厅"，这就是控制反转。**

用代码来说：

```java
// 传统方式：自己创建依赖（你在"做菜"）
public class OrderService {
    private UserDao userDao = new UserDaoImpl(); // 硬编码，强耦合
}

// IoC 方式：容器帮你注入依赖（"餐厅"帮你端上来）
@Service
public class OrderService {
    private final UserDao userDao; // 只声明需要什么

    public OrderService(UserDao userDao) { // 容器自动注入
        this.userDao = userDao;
    }
}
```

**为什么这样设计？** 因为 `OrderService` 不应该关心 `UserDao` 的具体实现是 MySQL 版还是 MongoDB 版，它只需要"用"就行。这种解耦让代码更灵活、更容易测试。

### 1.2 什么是 DI（依赖注入）

DI 是 IoC 的一种具体实现方式。IoC 是一种思想（控制权转移），DI 是实现这个思想的手段（通过注入的方式提供依赖）。

打个比方：IoC 是"让别人帮你做饭"这个概念，DI 就是"服务员把菜端到你桌上"这个动作。

### 1.3 BeanFactory vs ApplicationContext

```
┌─────────────────────────────────────────────────────┐
│                  BeanFactory                         │
│  (Spring 最底层的容器接口)                            │
│                                                      │
│  核心能力：                                           │
│  - getBean() 获取 Bean                               │
│  - containsBean() 判断是否存在                        │
│  - isSingleton() / isPrototype()                     │
│  - 延迟加载（Lazy Loading）：用到时才创建 Bean          │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │           ApplicationContext                     │ │
│  │  (BeanFactory 的增强版，日常开发用它)              │ │
│  │                                                  │ │
│  │  继承 BeanFactory 全部能力，额外增加：              │ │
│  │  - 国际化支持（MessageSource）                    │ │
│  │  - 事件发布（ApplicationEventPublisher）          │ │
│  │  - 资源加载（ResourceLoader）                     │ │
│  │  - 环境变量（Environment）                        │ │
│  │  - 预加载（Eager Loading）：启动时就创建全部单例    │ │
│  │                                                  │ │
│  │  常见实现类：                                      │ │
│  │  - AnnotationConfigApplicationContext             │ │
│  │  - ClassPathXmlApplicationContext                 │ │
│  │  - GenericWebApplicationContext                   │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**关键区别总结：**

| 特性 | BeanFactory | ApplicationContext |
|------|------------|-------------------|
| Bean 加载时机 | 延迟加载（getBean 时才创建） | 预加载（启动时创建全部单例） |
| 国际化 | 不支持 | 支持 |
| 事件机制 | 不支持 | 支持 |
| AOP 支持 | 需要手动配置 | 自动集成 |
| 推荐场景 | 资源受限的嵌入式环境 | 99% 的应用场景 |

### 1.4 Bean 的完整生命周期

这是 Spring 面试的核心中的核心。一个 Bean 从出生到死亡，经历以下阶段：

```
                        Bean 的完整生命周期

  ┌──────────────────────────────────────────────────────┐
  │  第一阶段：BeanDefinition 加载                         │
  │  Spring 扫描 @Component/@Service/@Repository 等注解    │
  │  或读取 XML 配置，将 Bean 的元信息封装为 BeanDefinition  │
  │  存入 BeanDefinitionMap                               │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  第二阶段：实例化（Instantiation）                      │
  │  根据 BeanDefinition 通过反射调用构造方法创建对象         │
  │  此时对象已存在于内存，但属性都还是默认值（null / 0）      │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  第三阶段：属性填充（Populate Properties）              │
  │  Spring 将 @Autowired / @Value 等标注的依赖注入进来      │
  │  这一步完成后，Bean 的属性有值了                         │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  第四阶段：Aware 接口回调                               │
  │  如果 Bean 实现了特定的 Aware 接口，Spring 会回调：      │
  │  - BeanNameAware → setBeanName()                      │
  │  - BeanFactoryAware → setBeanFactory()                │
  │  - ApplicationContextAware → setApplicationContext()   │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  第五阶段：BeanPostProcessor 前置处理                   │
  │  所有 BeanPostProcessor 的                             │
  │  postProcessBeforeInitialization() 方法被调用           │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  第六阶段：初始化                                       │
  │  按以下顺序执行：                                       │
  │  1. @PostConstruct 注解的方法                           │
  │  2. InitializingBean 接口的 afterPropertiesSet()        │
  │  3. @Bean(initMethod="xxx") 指定的方法                  │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  第七阶段：BeanPostProcessor 后置处理                   │
  │  所有 BeanPostProcessor 的                             │
  │  postProcessAfterInitialization() 方法被调用            │
  │  *** AOP 代理对象就是在这一步生成的 ***                  │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  第八阶段：使用中                                       │
  │  Bean 被放入容器，可以被其他对象使用                      │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  第九阶段：销毁                                         │
  │  容器关闭时，按以下顺序执行：                             │
  │  1. @PreDestroy 注解的方法                              │
  │  2. DisposableBean 接口的 destroy()                    │
  │  3. @Bean(destroyMethod="xxx") 指定的方法               │
  └──────────────────────────────────────────────────────┘
```

**代码示例：观察 Bean 的完整生命周期**

```java
@Component
public class LifecycleDemoBean implements
        BeanNameAware,
        BeanFactoryAware,
        ApplicationContextAware,
        InitializingBean,
        DisposableBean {

    private String name;

    // 第二阶段：实例化（构造方法被调用）
    public LifecycleDemoBean() {
        System.out.println("1. 构造方法 —— Bean 实例化");
    }

    // 第三阶段：属性填充
    @Value("${demo.name:lifecycle-demo}")
    public void setName(String name) {
        this.name = name;
        System.out.println("2. 属性填充 —— @Value 注入 name=" + name);
    }

    // 第四阶段：Aware 接口回调
    @Override
    public void setBeanName(String beanName) {
        System.out.println("3. BeanNameAware —— beanName=" + beanName);
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        System.out.println("4. BeanFactoryAware —— 获得 BeanFactory 引用");
    }

    @Override
    public void setApplicationContext(ApplicationContext ctx) throws BeansException {
        System.out.println("5. ApplicationContextAware —— 获得 ApplicationContext 引用");
    }

    // 第六阶段：初始化（@PostConstruct 最先执行）
    @PostConstruct
    public void postConstruct() {
        System.out.println("7. @PostConstruct —— 注解标注的初始化方法");
    }

    // 第六阶段：InitializingBean 接口
    @Override
    public void afterPropertiesSet() throws Exception {
        System.out.println("8. InitializingBean.afterPropertiesSet()");
    }

    // 第九阶段：销毁（@PreDestroy 最先执行）
    @PreDestroy
    public void preDestroy() {
        System.out.println("10. @PreDestroy —— 注解标注的销毁方法");
    }

    @Override
    public void destroy() throws Exception {
        System.out.println("11. DisposableBean.destroy()");
    }
}

// 自定义 BeanPostProcessor 来观察第五、七阶段
@Component
public class CustomBeanPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        if (bean instanceof LifecycleDemoBean) {
            System.out.println("6. BeanPostProcessor 前置处理 —— before initialization");
        }
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (bean instanceof LifecycleDemoBean) {
            System.out.println("9. BeanPostProcessor 后置处理 —— after initialization（AOP 代理在此生成）");
        }
        return bean;
    }
}
```

**输出顺序：**
```
1. 构造方法 —— Bean 实例化
2. 属性填充 —— @Value 注入 name=lifecycle-demo
3. BeanNameAware —— beanName=lifecycleDemoBean
4. BeanFactoryAware —— 获得 BeanFactory 引用
5. ApplicationContextAware —— 获得 ApplicationContext 引用
6. BeanPostProcessor 前置处理 —— before initialization
7. @PostConstruct —— 注解标注的初始化方法
8. InitializingBean.afterPropertiesSet()
9. BeanPostProcessor 后置处理 —— after initialization（AOP 代理在此生成）
--- 应用运行中 ---
10. @PreDestroy —— 注解标注的销毁方法
11. DisposableBean.destroy()
```

### 1.5 Bean 的作用域

| 作用域 | 含义 | 创建时机 | 典型场景 |
|-------|------|---------|---------|
| **singleton**（默认） | 整个 IoC 容器中只有一个实例 | 容器启动时 | 无状态的 Service、Dao |
| **prototype** | 每次 getBean() 都创建新实例 | 每次请求时 | 有状态的对象（如多线程场景下的工具类） |
| **request** | 每个 HTTP 请求一个实例 | 每次 HTTP 请求 | 存储请求级别数据 |
| **session** | 每个 HTTP Session 一个实例 | 每次新 Session | 用户会话数据（购物车等） |
| **application** | 每个 ServletContext 一个实例 | 应用启动时 | 全局共享数据 |

```java
@Component
@Scope("prototype") // 声明为多例
public class PrototypeBean {
    // 每次注入都会创建新的实例
}

@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class RequestScopedBean {
    // 每个 HTTP 请求一个实例
    // proxyMode 是关键：让 singleton Bean 可以正确注入 request 作用域的 Bean
}
```

**注意：** 当 singleton Bean 依赖 prototype Bean 时，prototype Bean 只会被注入一次（因为 singleton 只初始化一次）。解决方案是使用 `ObjectProvider<T>` 或 `@Lookup` 注解。

```java
@Service
public class SingletonService {
    private final ObjectProvider<PrototypeBean> prototypeBeanProvider;

    public SingletonService(ObjectProvider<PrototypeBean> prototypeBeanProvider) {
        this.prototypeBeanProvider = prototypeBeanProvider;
    }

    public void doSomething() {
        // 每次调用 getObject() 都会获取新的 PrototypeBean 实例
        PrototypeBean bean = prototypeBeanProvider.getObject();
    }
}
```

> **一句话总结：** IoC 让对象的创建和管理从"你自己做"变成"容器帮你做"，DI 是容器"把东西送到你手上"的方式，Bean 生命周期就是"从出生到死亡"的全过程。

---

## 二、依赖注入的三种方式

### 2.1 字段注入（Field Injection）

```java
@Service
public class OrderService {
    @Autowired
    private UserService userService; // 直接在字段上标注

    @Autowired
    private ProductService productService;
}
```

**特点：** 代码最简洁，但有隐患。

### 2.2 Setter 注入（Setter Injection）

```java
@Service
public class OrderService {
    private UserService userService;
    private ProductService productService;

    @Autowired
    public void setUserService(UserService userService) {
        this.userService = userService;
    }

    @Autowired
    public void setProductService(ProductService productService) {
        this.productService = productService;
    }
}
```

**特点：** 依赖可以在运行时被修改（可选依赖的场景）。

### 2.3 构造器注入（Constructor Injection）

```java
@Service
public class OrderService {
    private final UserService userService;     // final！不可变
    private final ProductService productService; // final！不可变

    // 当只有一个构造器时，@Autowired 可以省略（Spring 4.3+）
    public OrderService(UserService userService, ProductService productService) {
        this.userService = userService;
        this.productService = productService;
    }
}
```

**特点：** Spring 官方推荐的方式。

### 2.4 三种方式的优缺点对比

| 特性 | 字段注入 | Setter 注入 | 构造器注入 |
|------|---------|------------|-----------|
| 代码简洁度 | 最简洁 | 较繁琐 | 适中 |
| 不可变性（final） | 不支持 | 不支持 | **支持** |
| 依赖完整性保证 | 不保证（可能为 null） | 不保证 | **保证（创建时就全部注入）** |
| 单元测试友好度 | 差（需反射注入 mock） | 较好 | **最好（直接 new 传参）** |
| 循环依赖检测 | 不能检测 | 不能检测 | **启动时立即报错** |
| 隐藏依赖 | 是（外部看不到依赖了谁） | 否 | **否** |
| NPE 风险 | 高 | 中 | **低** |

### 2.5 为什么 Spring 官方推荐构造器注入

**原因一：不可变性**
```java
// 构造器注入可以用 final 修饰，防止依赖被意外修改
private final UserService userService; // 一旦注入就不会变
```

**原因二：完整性保证**
```java
// 构造器注入时，如果依赖缺失，Spring 启动时就会报错，属于 fail-fast
// 而字段注入可能在运行时才发现 NPE
```

**原因三：单元测试友好**
```java
// 构造器注入的测试：直接 new 就行，不需要启动 Spring 容器
@Test
void testOrder() {
    UserService mockUserService = Mockito.mock(UserService.class);
    ProductService mockProductService = Mockito.mock(ProductService.class);

    // 直接通过构造器传入 mock 对象
    OrderService orderService = new OrderService(mockUserService, mockProductService);
    // 测试...
}

// 字段注入的测试：必须用 @InjectMocks 或反射，麻烦且不直观
```

### 2.6 @Autowired vs @Resource vs @Inject 的区别

| 特性 | @Autowired | @Resource | @Inject |
|------|-----------|-----------|---------|
| 来源 | Spring 框架 | JDK 标准（JSR-250） | JDK 标准（JSR-330） |
| 匹配方式 | **先按类型**，再按名称 | **先按名称**，再按类型 | **先按类型**，再按名称 |
| 必须性 | `required=false` 可选 | 默认必须 | 默认必须 |
| 适用位置 | 字段、构造器、Setter | 字段、Setter（不支持构造器） | 字段、构造器、Setter |
| 配合限定 | @Qualifier | name 属性 | @Named |

```java
// @Autowired：按类型匹配，类型相同时按变量名匹配
@Autowired
private UserService userService;

// @Resource：先按名称匹配（name="userServiceImpl"），找不到再按类型
@Resource(name = "userServiceImpl")
private UserService userService;

// @Inject：行为类似 @Autowired，但来自 JDK 标准
@Inject
private UserService userService;
```

### 2.7 @Qualifier 和 @Primary 解决多实现类冲突

当一个接口有多个实现类时，Spring 不知道注入哪个，就会报错。两种解决方式：

**方式一：@Primary —— 指定"默认选手"**

```java
public interface PaymentService {
    void pay(BigDecimal amount);
}

@Service
@Primary  // 当有多个实现时，默认选这个
public class AlipayService implements PaymentService {
    @Override
    public void pay(BigDecimal amount) {
        System.out.println("支付宝支付：" + amount);
    }
}

@Service
public class WechatPayService implements PaymentService {
    @Override
    public void pay(BigDecimal amount) {
        System.out.println("微信支付：" + amount);
    }
}
```

**方式二：@Qualifier —— 指定"具体选谁"**

```java
@Service
public class OrderService {
    private final PaymentService paymentService;

    public OrderService(@Qualifier("wechatPayService") PaymentService paymentService) {
        this.paymentService = paymentService; // 明确指定要微信支付
    }
}
```

**优先级：** `@Qualifier` > `@Primary`。如果同时使用，`@Qualifier` 的指定会覆盖 `@Primary`。

> **一句话总结：** 优先使用构造器注入（不可变 + 完整性 + 测试友好），用 @Qualifier 或 @Primary 解决多实现类冲突，@Autowired 按类型匹配、@Resource 按名称匹配。

---

## 三、AOP 深度剖析

### 3.1 AOP 核心概念

**通俗类比：** 想象你住在一栋公寓楼里，每个住户（业务方法）各自生活。物业公司（AOP）决定在公寓的每层楼道安装监控摄像头（通知），这些摄像头不需要住户自己安装、不影响住户的日常生活，但却能在关键位置（切点）记录发生的一切。

| 概念 | 英文 | 通俗理解 | Spring 中的体现 |
|------|------|---------|----------------|
| 切面（Aspect） | Aspect | 物业公司的"安保方案" | 用 @Aspect 标注的类 |
| 连接点（JoinPoint） | JoinPoint | 公寓里每一个可以装摄像头的位置 | 每一个方法的执行 |
| 切点（Pointcut） | Pointcut | 实际决定在哪些位置装摄像头 | @Pointcut 表达式 |
| 通知（Advice） | Advice | 摄像头"在什么时候做什么" | @Before / @After / @Around 等 |
| 织入（Weaving） | Weaving | 安装摄像头的过程 | Spring 在运行时通过代理织入 |

### 3.2 动态代理：JDK 动态代理 vs CGLIB 代理

**核心问题：** Spring AOP 的底层是通过生成代理对象来实现的。代理对象"包裹"了目标对象，在调用目标方法前后插入增强逻辑。

#### JDK 动态代理

**原理：** 基于 Java 的 `java.lang.reflect.Proxy`，在运行时动态生成一个实现了目标接口的代理类。

**前提：** 目标类必须实现至少一个接口。

```java
// 目标接口
public interface UserService {
    String findUser(Long id);
}

// 目标实现
public class UserServiceImpl implements UserService {
    @Override
    public String findUser(Long id) {
        return "用户-" + id;
    }
}

// JDK 动态代理的简化实现
public class JdkProxyDemo {
    public static void main(String[] args) {
        UserService target = new UserServiceImpl();

        // 生成代理对象
        UserService proxy = (UserService) Proxy.newProxyInstance(
            target.getClass().getClassLoader(),
            target.getClass().getInterfaces(),  // 基于接口
            (proxyObj, method, arguments) -> {
                System.out.println("[前置通知] 方法调用前：" + method.getName());
                Object result = method.invoke(target, arguments); // 调用真实方法
                System.out.println("[后置通知] 方法调用后：" + method.getName());
                return result;
            }
        );

        // proxy 是 UserService 的实现，但不是 UserServiceImpl 的子类
        System.out.println(proxy.findUser(1L));
        System.out.println(proxy instanceof UserService);     // true
        System.out.println(proxy instanceof UserServiceImpl);  // false
    }
}
```

#### CGLIB 代理

**原理：** 基于字节码生成技术（ASM 库），在运行时动态生成目标类的子类作为代理类。

**前提：** 目标类不能是 `final` 的（因为要继承它）。

```java
// 目标类（不需要实现接口）
public class ProductService {
    public String findProduct(Long id) {
        return "商品-" + id;
    }
}

// CGLIB 代理的简化实现
public class CglibProxyDemo {
    public static void main(String[] args) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(ProductService.class); // 设置父类（继承方式）
        enhancer.setCallback((MethodInterceptor) (obj, method, arguments, methodProxy) -> {
            System.out.println("[前置通知] 方法调用前：" + method.getName());
            Object result = methodProxy.invokeSuper(obj, arguments); // 调用父类方法
            System.out.println("[后置通知] 方法调用后：" + method.getName());
            return result;
        });

        ProductService proxy = (ProductService) enhancer.create();

        // proxy 是 ProductService 的子类
        System.out.println(proxy.findProduct(1L));
        System.out.println(proxy instanceof ProductService); // true
    }
}
```

#### Spring 如何选择代理方式

```
                     Spring 选择代理方式的决策流程

  ┌─────────────────────────────────┐
  │  目标类是否实现了接口？            │
  └───────────┬─────────────────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
   是(有接口)        否(没有接口)
     │                 │
     ▼                 ▼
  Spring Boot 2.x 之前：   一定使用 CGLIB
  默认用 JDK 动态代理

  Spring Boot 2.x 之后：
  默认全部用 CGLIB
  (spring.aop.proxy-target-class=true)
```

**为什么 Spring Boot 2.x 之后默认使用 CGLIB？**

因为 JDK 动态代理只能代理接口，在注入时如果用实现类类型接收（而非接口类型），会抛出类型转换异常。CGLIB 代理生成的是子类，既能用接口类型接收，也能用实现类类型接收，更加通用。

### 3.3 五种通知类型

```java
@Aspect
@Component
public class LogAspect {

    // 定义切点：匹配 com.example.service 包下所有类的所有方法
    @Pointcut("execution(* com.example.service..*.*(..))")
    public void servicePointcut() {}

    // 前置通知：方法执行前
    @Before("servicePointcut()")
    public void before(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        System.out.println("[Before] 即将执行方法：" + methodName);
    }

    // 后置通知：方法执行后（无论是否异常都会执行，类似 finally）
    @After("servicePointcut()")
    public void after(JoinPoint joinPoint) {
        System.out.println("[After] 方法执行结束（无论成功或异常）");
    }

    // 返回通知：方法正常返回后
    @AfterReturning(pointcut = "servicePointcut()", returning = "result")
    public void afterReturning(JoinPoint joinPoint, Object result) {
        System.out.println("[AfterReturning] 返回值：" + result);
    }

    // 异常通知：方法抛出异常后
    @AfterThrowing(pointcut = "servicePointcut()", throwing = "ex")
    public void afterThrowing(JoinPoint joinPoint, Exception ex) {
        System.out.println("[AfterThrowing] 异常信息：" + ex.getMessage());
    }

    // 环绕通知：最强大的通知，可以控制方法是否执行、修改参数和返回值
    @Around("servicePointcut()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        long startTime = System.currentTimeMillis();
        System.out.println("[Around-前] 方法开始执行");

        Object result = pjp.proceed(); // 执行目标方法（如果不调用，目标方法就不会执行！）

        long cost = System.currentTimeMillis() - startTime;
        System.out.println("[Around-后] 方法执行完毕，耗时：" + cost + "ms");
        return result;
    }
}
```

### 3.4 切面执行顺序

**多个切面的排序：** 使用 `@Order` 注解，值越小优先级越高。

```
  请求进入方向 ──────────────────────────────────────────▶

  ┌─────────────────────────────────────────────────────┐
  │  @Order(1) 切面A                                     │
  │  ┌─────────────────────────────────────────────────┐ │
  │  │  @Order(2) 切面B                                 │ │
  │  │  ┌─────────────────────────────────────────────┐ │ │
  │  │  │        目标方法                               │ │ │
  │  │  └─────────────────────────────────────────────┘ │ │
  │  └─────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────┘

  执行顺序（正常情况）：
  切面A @Around-前
    切面A @Before
      切面B @Around-前
        切面B @Before
          ── 目标方法执行 ──
        切面B @AfterReturning
        切面B @After
      切面B @Around-后
    切面A @AfterReturning
    切面A @After
  切面A @Around-后
```

**同一切面内通知的执行顺序（Spring 5.2.7+）：**

正常情况：`@Around-前` → `@Before` → 目标方法 → `@AfterReturning` → `@After` → `@Around-后`

异常情况：`@Around-前` → `@Before` → 目标方法(异常) → `@AfterThrowing` → `@After`

### 3.5 AOP 的实战应用场景

#### 场景一：声明式事务

```java
// @Transactional 的底层就是 AOP
// Spring 通过 TransactionInterceptor 这个切面来实现事务管理
@Service
public class OrderService {
    @Transactional // 底层是一个环绕通知：开启事务 → 执行方法 → 提交/回滚
    public void createOrder(OrderDTO orderDTO) {
        // 业务逻辑...
    }
}
```

#### 场景二：统一日志记录

```java
@Aspect
@Component
@Slf4j
public class ApiLogAspect {

    @Around("@annotation(apiLog)")
    public Object logApi(ProceedingJoinPoint pjp, ApiLog apiLog) throws Throwable {
        String methodName = pjp.getSignature().toShortString();
        Object[] args = pjp.getArgs();

        log.info("请求方法：{}，参数：{}", methodName, Arrays.toString(args));
        long start = System.currentTimeMillis();

        try {
            Object result = pjp.proceed();
            log.info("响应结果：{}，耗时：{}ms", result, System.currentTimeMillis() - start);
            return result;
        } catch (Throwable e) {
            log.error("方法异常：{}，错误：{}", methodName, e.getMessage());
            throw e;
        }
    }
}

// 自定义注解
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface ApiLog {
    String value() default "";
}

// 使用
@RestController
public class UserController {
    @ApiLog("查询用户")
    @GetMapping("/users/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
```

#### 场景三：接口限流

```java
@Aspect
@Component
public class RateLimitAspect {

    private final Map<String, RateLimiter> rateLimiterMap = new ConcurrentHashMap<>();

    @Around("@annotation(rateLimit)")
    public Object limit(ProceedingJoinPoint pjp, RateLimit rateLimit) throws Throwable {
        String key = pjp.getSignature().toShortString();
        // 每个方法创建一个限流器，每秒允许 rateLimit.qps() 个请求
        RateLimiter limiter = rateLimiterMap.computeIfAbsent(key,
                k -> RateLimiter.create(rateLimit.qps()));

        if (!limiter.tryAcquire(rateLimit.timeout(), TimeUnit.MILLISECONDS)) {
            throw new RuntimeException("请求过于频繁，请稍后再试");
        }
        return pjp.proceed();
    }
}
```

### 3.6 AOP 失效的场景与原因

**根本原因：** Spring AOP 基于代理实现。只有通过代理对象调用方法，切面逻辑才会生效。

| 失效场景 | 原因 | 解决方案 |
|---------|------|---------|
| 同一个类中方法 A 调用方法 B（自调用） | `this.methodB()` 是直接调用，不经过代理 | 注入自身 / 使用 `AopContext.currentProxy()` |
| final 方法 | CGLIB 通过继承实现，final 方法不能被重写 | 去掉 final 修饰符 |
| private 方法 | 代理无法重写 private 方法 | 改为 public 或 protected |
| static 方法 | 静态方法属于类，不属于实例，代理无法拦截 | 改为实例方法 |
| 未被 Spring 管理的对象 | 手动 new 出来的对象没有代理 | 让 Spring 管理该对象 |

```java
@Service
public class OrderService {

    @Transactional
    public void createOrder() {
        // ... 创建订单
        this.sendNotification(); // 自调用！@Async 不会生效！
    }

    @Async
    public void sendNotification() {
        // 这里的 @Async 不会生效，因为是 this 直接调用
    }

    // 解决方案一：注入自身
    @Autowired
    @Lazy // 加 @Lazy 避免循环依赖
    private OrderService self;

    @Transactional
    public void createOrderFixed() {
        // ... 创建订单
        self.sendNotification(); // 通过代理对象调用，@Async 生效
    }
}
```

> **一句话总结：** AOP 的本质是动态代理（JDK 或 CGLIB），通过"代理包裹"在不修改源码的前提下增强方法；凡是绕过代理的调用（自调用、final、private），AOP 都会失效。

---

## 四、Spring Boot 自动配置原理

### 4.1 @SpringBootApplication 三合一拆解

```java
@SpringBootApplication
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}

// @SpringBootApplication 实际上是三个注解的组合：
@SpringBootConfiguration    // 本质就是 @Configuration，标识这是一个配置类
@EnableAutoConfiguration    // 核心！开启自动配置
@ComponentScan             // 扫描当前包及其子包下的 @Component 等注解
public @interface SpringBootApplication {
    // ...
}
```

**为什么启动类要放在根包下？** 因为 `@ComponentScan` 默认扫描启动类所在的包及其所有子包。如果启动类在 `com.example`，那么 `com.example.service`、`com.example.controller` 等包都会被扫描到。

### 4.2 @EnableAutoConfiguration 的工作机制

```
@EnableAutoConfiguration
    │
    ├── @Import(AutoConfigurationImportSelector.class)
    │       │
    │       ▼
    │   AutoConfigurationImportSelector 核心方法：
    │   selectImports()
    │       │
    │       ▼
    │   getAutoConfigurationEntry()
    │       │
    │       ▼
    │   getCandidateConfigurations()
    │       │
    │       ▼
    │   SpringFactoriesLoader.loadFactoryNames()  (Spring Boot 2.x)
    │                 或
    │   ImportCandidates.load()                    (Spring Boot 3.x)
    │       │
    │       ▼
    │   读取 META-INF/spring.factories             (2.x)
    │                 或
    │   META-INF/spring/org.springframework.boot.  (3.x)
    │   autoconfigure.AutoConfiguration.imports
    │       │
    │       ▼
    │   获得所有自动配置类的全限定名列表
    │   （比如有 100+ 个自动配置类）
    │       │
    │       ▼
    │   经过 @Conditional 条件过滤
    │   （只有满足条件的才真正生效）
    │       │
    │       ▼
    │   最终只有 20-30 个自动配置类被加载
    │
    └── @AutoConfigurationPackage
            │
            ▼
        将启动类所在包注册到 AutoConfigurationPackages
        供其他组件（如 JPA Entity 扫描）使用
```

### 4.3 spring.factories 到 AutoConfiguration.imports 的演进

**Spring Boot 2.x 时代：**
```
# META-INF/spring.factories
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.example.DataSourceAutoConfiguration,\
  com.example.RedisAutoConfiguration,\
  ...
```

**Spring Boot 3.x 时代：**
```
# META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
# 一行一个类名，更清晰
com.example.DataSourceAutoConfiguration
com.example.RedisAutoConfiguration
```

**为什么要迁移？**
- `spring.factories` 是一个多用途文件，所有类型的工厂配置都堆在一起，不够清晰
- 新的文件结构更加简洁，按职责分离
- 性能更好：只需要读取特定文件，不需要解析整个 spring.factories

### 4.4 条件注解体系详解

条件注解是自动配置的灵魂。它们决定了一个自动配置类"是否应该生效"。

```java
@Configuration
@ConditionalOnClass(DataSource.class)
// 只有 classpath 中存在 DataSource 类时，这个配置类才生效
// 即：你引入了数据库相关的 jar 包时才生效

@ConditionalOnMissingBean(DataSource.class)
// 只有容器中还没有 DataSource 类型的 Bean 时才生效
// 即：如果你自己已经手动配置了 DataSource，就不会自动配置

@ConditionalOnProperty(prefix = "spring.datasource", name = "url")
// 只有配置文件中存在 spring.datasource.url 属性时才生效
// 即：你配置了数据库连接地址时才自动配置

public class DataSourceAutoConfiguration {
    // ...
}
```

**常用条件注解速查表：**

| 注解 | 含义 | 典型用途 |
|------|------|---------|
| `@ConditionalOnClass` | classpath 中存在指定类 | 判断是否引入了某个依赖 |
| `@ConditionalOnMissingClass` | classpath 中不存在指定类 | 排斥型条件 |
| `@ConditionalOnBean` | 容器中已存在指定 Bean | 依赖其他 Bean |
| `@ConditionalOnMissingBean` | 容器中不存在指定 Bean | "你没配我就帮你配" |
| `@ConditionalOnProperty` | 配置文件中存在指定属性 | 根据配置开关功能 |
| `@ConditionalOnWebApplication` | 当前是 Web 应用 | 只在 Web 环境生效 |
| `@ConditionalOnNotWebApplication` | 当前不是 Web 应用 | 只在非 Web 环境生效 |
| `@ConditionalOnExpression` | SpEL 表达式为 true | 复杂条件判断 |

### 4.5 以 DataSourceAutoConfiguration 为例走一遍完整链路

```
第一步：应用启动
┌──────────────────────────────────────────────────────────────┐
│ SpringApplication.run(MyApp.class, args)                     │
│ @SpringBootApplication 中的 @EnableAutoConfiguration 被触发    │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
第二步：加载自动配置类列表
┌──────────────────────────────────────────────────────────────┐
│ AutoConfigurationImportSelector 读取                          │
│ META-INF/spring/...AutoConfiguration.imports                 │
│ 找到 DataSourceAutoConfiguration                              │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
第三步：条件判断
┌──────────────────────────────────────────────────────────────┐
│ @ConditionalOnClass({DataSource.class, EmbeddedDatabaseType  │
│ .class})                                                     │
│                                                              │
│ 检查结果：classpath 中有 DataSource 和 EmbeddedDatabaseType？  │
│                                                              │
│ → 如果你引入了 spring-boot-starter-jdbc 或                    │
│   spring-boot-starter-data-jpa，这些类就存在                   │
│ → 条件满足，继续                                               │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
第四步：读取配置属性
┌──────────────────────────────────────────────────────────────┐
│ @EnableConfigurationProperties(DataSourceProperties.class)    │
│                                                              │
│ 读取 application.yml 中的配置：                                │
│ spring:                                                      │
│   datasource:                                                │
│     url: jdbc:mysql://localhost:3306/mydb                    │
│     username: root                                           │
│     password: 123456                                         │
│     driver-class-name: com.mysql.cj.jdbc.Driver              │
│                                                              │
│ 这些配置会被绑定到 DataSourceProperties 对象                    │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
第五步：创建 DataSource Bean
┌──────────────────────────────────────────────────────────────┐
│ @ConditionalOnMissingBean(DataSource.class)                  │
│ → 容器中还没有 DataSource？那我来创建一个                       │
│                                                              │
│ 根据配置创建 HikariDataSource（Spring Boot 默认连接池）         │
│                                                              │
│ 如果你已经手动定义了 @Bean DataSource，这里就不会执行            │
│ 这就是"约定优于配置"的体现！                                    │
└──────────────────────────────────────────────────────────────┘
```

### 4.6 如何查看哪些自动配置生效了

```yaml
# application.yml
debug: true
```

启动后控制台会打印：

```
============================
CONDITIONS EVALUATION REPORT
============================

Positive matches:     （生效的自动配置）
-----------------
   DataSourceAutoConfiguration matched:
      - @ConditionalOnClass found required classes 'javax.sql.DataSource'

Negative matches:     （未生效的自动配置）
-----------------
   ActiveMQAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required class 'javax.jms.ConnectionFactory'
```

> **一句话总结：** 自动配置的本质是"根据你引入了什么依赖 + 配置了什么属性，自动帮你创建对应的 Bean"，条件注解就是这个判断的核心机制。

---

## 五、Starter 机制

### 5.1 Starter 是什么？解决什么问题？

**类比：** Starter 就像"套餐"。你去快餐店不需要单独点"面包 + 牛肉饼 + 生菜 + 番茄酱 + 可乐"，直接说"一个巨无霸套餐"就行了。

**没有 Starter 之前的痛苦：**
```xml
<!-- 想用 Redis？你得自己引入一堆依赖 -->
<dependency>spring-data-redis</dependency>
<dependency>lettuce-core</dependency>
<dependency>spring-context</dependency>
<!-- 还要写大量配置类... -->
```

**有了 Starter 之后：**
```xml
<!-- 一个 Starter 搞定一切 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<!-- 自动引入所有需要的依赖 + 自动配置 -->
```

### 5.2 一个 Starter 的组成结构

```
my-spring-boot-starter（Starter 模块）
├── pom.xml                     # 依赖聚合，引入 autoconfigure 模块和第三方依赖
└── （通常没有代码）

my-spring-boot-starter-autoconfigure（自动配置模块）
├── pom.xml
└── src/main/java
    └── com.example.autoconfigure
        ├── MyServiceProperties.java            # 配置属性类
        ├── MyService.java                      # 核心服务类
        └── MyServiceAutoConfiguration.java     # 自动配置类
└── src/main/resources
    └── META-INF
        └── spring
            └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

### 5.3 命名规范

| 类型 | 命名规范 | 示例 |
|------|---------|------|
| Spring Boot 官方 | `spring-boot-starter-{模块名}` | `spring-boot-starter-web` |
| 第三方 | `{模块名}-spring-boot-starter` | `mybatis-spring-boot-starter` |

### 5.4 手写一个自定义 Starter（完整代码示例）

**需求：** 实现一个短信发送的 Starter，引入后只需配置 `sms.api-key` 和 `sms.api-secret` 就能使用。

#### 第一步：创建 autoconfigure 模块

**pom.xml：**
```xml
<project>
    <groupId>com.example</groupId>
    <artifactId>sms-spring-boot-starter-autoconfigure</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-autoconfigure</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-configuration-processor</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>
</project>
```

#### 第二步：编写配置属性类

```java
package com.example.sms.autoconfigure;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "sms")
public class SmsProperties {

    /**
     * 短信服务的 API Key
     */
    private String apiKey;

    /**
     * 短信服务的 API Secret
     */
    private String apiSecret;

    /**
     * 短信签名，默认值"MyApp"
     */
    private String signName = "MyApp";

    /**
     * 是否启用短信服务，默认 true
     */
    private boolean enabled = true;

    // getter / setter 省略
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getApiSecret() { return apiSecret; }
    public void setApiSecret(String apiSecret) { this.apiSecret = apiSecret; }
    public String getSignName() { return signName; }
    public void setSignName(String signName) { this.signName = signName; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
```

#### 第三步：编写核心服务类

```java
package com.example.sms.autoconfigure;

public class SmsService {

    private final SmsProperties properties;

    public SmsService(SmsProperties properties) {
        this.properties = properties;
    }

    /**
     * 发送短信
     * @param phone  手机号
     * @param content 短信内容
     * @return 是否发送成功
     */
    public boolean send(String phone, String content) {
        // 实际场景中这里调用第三方短信 API
        System.out.println("使用 API Key: " + properties.getApiKey());
        System.out.println("发送短信到: " + phone);
        System.out.println("签名: [" + properties.getSignName() + "] " + content);
        // 调用第三方 SDK 发送...
        return true;
    }
}
```

#### 第四步：编写自动配置类

```java
package com.example.sms.autoconfigure;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration // Spring Boot 3.x 使用 @AutoConfiguration 替代 @Configuration
@EnableConfigurationProperties(SmsProperties.class)
@ConditionalOnProperty(prefix = "sms", name = "enabled", havingValue = "true", matchIfMissing = true)
// 当 sms.enabled=true 时生效（默认 true）
public class SmsAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean // 如果用户自己定义了 SmsService，就用用户的
    public SmsService smsService(SmsProperties properties) {
        return new SmsService(properties);
    }
}
```

#### 第五步：注册自动配置（Spring Boot 3.x 方式）

创建文件 `src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`：

```
com.example.sms.autoconfigure.SmsAutoConfiguration
```

#### 第六步：创建 Starter 模块

**pom.xml：**
```xml
<project>
    <groupId>com.example</groupId>
    <artifactId>sms-spring-boot-starter</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <!-- 引入 autoconfigure 模块 -->
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>sms-spring-boot-starter-autoconfigure</artifactId>
            <version>1.0.0</version>
        </dependency>
        <!-- 可以引入第三方短信 SDK -->
    </dependencies>
</project>
```

#### 第七步：在业务项目中使用

```xml
<!-- 引入自定义 Starter -->
<dependency>
    <groupId>com.example</groupId>
    <artifactId>sms-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

```yaml
# application.yml
sms:
  api-key: your-api-key
  api-secret: your-api-secret
  sign-name: 我的应用
```

```java
@Service
public class NotificationService {

    private final SmsService smsService; // 自动注入！

    public NotificationService(SmsService smsService) {
        this.smsService = smsService;
    }

    public void notifyUser(String phone, String message) {
        smsService.send(phone, message);
    }
}
```

> **一句话总结：** Starter = 依赖聚合 + 自动配置，让使用方"引入一个依赖 + 写几行配置"就能开箱即用。

---

## 六、Spring MVC 请求全链路

### 6.1 请求处理完整流程图

```
  客户端发起 HTTP 请求
         │
         ▼
  ┌─────────────────┐
  │   Tomcat 容器     │  接收 HTTP 请求，封装为 HttpServletRequest
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │  Filter 过滤链    │  CharacterEncodingFilter、CorsFilter 等
  │  (Servlet 规范)   │  在 Servlet 之前执行，可以修改 request/response
  └────────┬────────┘
           ▼
  ┌─────────────────────────────────────────────────────────┐
  │                  DispatcherServlet                       │
  │                  (前端控制器)                              │
  │                                                         │
  │  ┌─────────────────────┐                                │
  │  │  1. HandlerMapping   │  根据 URL 找到对应的 Handler     │
  │  │  (处理器映射器)        │  （即 Controller 的某个方法）     │
  │  └──────────┬──────────┘                                │
  │             ▼                                           │
  │  ┌─────────────────────┐                                │
  │  │  2. HandlerInterceptor│ 拦截器的 preHandle()           │
  │  │  (拦截器前置处理)      │  返回 true 继续，false 中断     │
  │  └──────────┬──────────┘                                │
  │             ▼                                           │
  │  ┌─────────────────────┐                                │
  │  │  3. HandlerAdapter   │  适配不同类型的 Handler          │
  │  │  (处理器适配器)        │  统一调用方式                    │
  │  │                      │                               │
  │  │  3a. 参数解析器        │  将 request 中的参数转为方法参数  │
  │  │  ArgumentResolver    │  @RequestParam/@RequestBody    │
  │  └──────────┬──────────┘                               │
  │             ▼                                           │
  │  ┌─────────────────────┐                                │
  │  │  4. Controller       │  执行业务逻辑                    │
  │  │  (处理器/控制器)       │  调用 Service → Dao             │
  │  └──────────┬──────────┘                                │
  │             ▼                                           │
  │  ┌─────────────────────┐                                │
  │  │  5. ReturnValueHandler│ 返回值处理器                   │
  │  │  + HttpMessageConverter│ @ResponseBody 时              │
  │  │  (返回值处理)          │ 将对象序列化为 JSON             │
  │  └──────────┬──────────┘                                │
  │             ▼                                           │
  │  ┌─────────────────────┐                                │
  │  │  6. HandlerInterceptor│ 拦截器的 postHandle()          │
  │  │  (拦截器后置处理)      │                               │
  │  └──────────┬──────────┘                                │
  │             ▼                                           │
  │  ┌─────────────────────┐                                │
  │  │  7. ViewResolver     │  如果返回视图名，解析为视图对象    │
  │  │  (视图解析器)         │  前后端分离时通常不需要           │
  │  └──────────┬──────────┘                                │
  │             ▼                                           │
  │  ┌─────────────────────┐                                │
  │  │  8. HandlerInterceptor│ 拦截器的 afterCompletion()     │
  │  │  (完成后处理)          │  无论成功或异常都会执行          │
  │  └─────────────────────┘                                │
  │                                                         │
  └──────────────────────┬──────────────────────────────────┘
                         ▼
  ┌─────────────────┐
  │  Filter 过滤链    │  Filter 的后续处理（chain.doFilter 之后的代码）
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │  Tomcat 容器     │  将 HttpServletResponse 转为 HTTP 响应
  └────────┬────────┘
           ▼
  客户端收到 HTTP 响应
```

### 6.2 各组件职责与源码关键类

#### DispatcherServlet

**职责：** 整个 Spring MVC 的"大脑"，负责协调所有组件完成请求处理。

```java
// DispatcherServlet.doDispatch() 核心伪代码
protected void doDispatch(HttpServletRequest request, HttpServletResponse response)
        throws Exception {

    // 1. 根据请求找到 Handler（Controller 方法）
    HandlerExecutionChain mappedHandler = getHandler(request);
    if (mappedHandler == null) {
        noHandlerFound(request, response); // 404
        return;
    }

    // 2. 找到能执行该 Handler 的适配器
    HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());

    // 3. 执行拦截器的 preHandle
    if (!mappedHandler.applyPreHandle(request, response)) {
        return; // 拦截器拒绝，直接返回
    }

    // 4. 通过适配器执行 Handler（Controller 方法）
    ModelAndView mv = ha.handle(request, response, mappedHandler.getHandler());

    // 5. 执行拦截器的 postHandle
    mappedHandler.applyPostHandle(request, response, mv);

    // 6. 处理结果（渲染视图或写入响应体）
    processDispatchResult(request, response, mappedHandler, mv, null);

    // 7. 在 finally 中执行拦截器的 afterCompletion
}
```

#### HandlerMapping

**职责：** 根据请求 URL 找到对应的 Handler（Controller 方法）。

| 实现类 | 说明 |
|-------|------|
| `RequestMappingHandlerMapping` | 处理 `@RequestMapping` 注解，最常用 |
| `SimpleUrlHandlerMapping` | 基于 URL 路径映射 |
| `BeanNameUrlHandlerMapping` | 基于 Bean 名称映射 |

路由匹配策略：Spring Boot 2.6+ 默认使用 `PathPatternParser`（替代了原来的 `AntPathMatcher`），性能更好。

#### HandlerAdapter（适配器模式）

**为什么需要适配器？** 因为 Handler 可能是 `@Controller` 注解的方法、也可能是实现了 `Controller` 接口的类、还可能是 `HttpRequestHandler`。适配器将不同类型的 Handler 统一为同一种调用方式。

```
HandlerAdapter 接口
    │
    ├── RequestMappingHandlerAdapter    处理 @RequestMapping 注解的方法
    ├── HttpRequestHandlerAdapter       处理 HttpRequestHandler
    └── SimpleControllerHandlerAdapter  处理实现了 Controller 接口的类
```

#### 参数解析器（HandlerMethodArgumentResolver）

```java
// 不同的注解由不同的参数解析器处理
@GetMapping("/users")
public List<User> getUsers(
    @RequestParam String name,          // RequestParamMethodArgumentResolver
    @RequestBody UserQuery query,        // RequestResponseBodyMethodProcessor
    @PathVariable Long id,               // PathVariableMethodArgumentResolver
    @RequestHeader String token,         // RequestHeaderMethodArgumentResolver
    HttpServletRequest request           // ServletRequestMethodArgumentResolver
) {
    // ...
}
```

#### 返回值处理器（HandlerMethodReturnValueHandler）

```java
// @ResponseBody 的处理流程：
// 1. RequestResponseBodyMethodProcessor 处理 @ResponseBody 返回值
// 2. 通过内容协商（Content Negotiation）确定响应格式
// 3. 选择合适的 HttpMessageConverter 进行序列化
// 4. 默认使用 MappingJackson2HttpMessageConverter 将对象转为 JSON
// 5. 写入 HttpServletResponse 的输出流

@RestController // @RestController = @Controller + @ResponseBody
public class UserController {

    @GetMapping("/users/{id}")
    public User getUser(@PathVariable Long id) {
        // 返回 User 对象 → Jackson 序列化为 JSON → 写入响应体
        return userService.findById(id);
    }
}
```

### 6.3 拦截器 vs 过滤器

| 特性 | Filter（过滤器） | HandlerInterceptor（拦截器） |
|------|-----------------|---------------------------|
| 规范 | Servlet 规范 | Spring 框架 |
| 作用范围 | 所有请求（包括静态资源） | 只对 DispatcherServlet 处理的请求 |
| 触发时机 | DispatcherServlet 之前 | DispatcherServlet 之内 |
| 能否获取 Handler 信息 | 不能 | 能（知道要调用哪个 Controller 方法） |
| 能否获取 Spring Bean | 不方便 | 方便（本身就是 Spring Bean） |
| 执行顺序 | 基于 FilterChain | 基于注册顺序（可用 @Order） |
| 异常处理 | 需要自己处理 | 可以被 @ControllerAdvice 捕获 |
| 典型用途 | 编码、CORS、压缩 | 登录校验、权限、日志 |

**执行顺序图：**

```
  请求 → Filter1 → Filter2 → DispatcherServlet
                                    │
                              preHandle(Interceptor1)
                              preHandle(Interceptor2)
                                    │
                              Controller 方法执行
                                    │
                              postHandle(Interceptor2)
                              postHandle(Interceptor1)
                                    │
                              视图渲染
                                    │
                              afterCompletion(Interceptor2)
                              afterCompletion(Interceptor1)
                                    │
         响应 ← Filter1 ← Filter2 ← DispatcherServlet
```

注意：拦截器的 preHandle 是正序执行，postHandle 和 afterCompletion 是倒序执行（类似栈的先进后出）。

> **一句话总结：** Spring MVC 的核心就是 DispatcherServlet 这个"总调度员"，它按照 HandlerMapping 找方法、HandlerAdapter 调方法、HttpMessageConverter 转结果的流程，完成从请求到响应的全链路。

---

## 七、事务管理

### 7.1 Spring 事务的核心抽象

```
                PlatformTransactionManager
                (事务管理器顶层接口)
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
  DataSourceTransaction  JpaTransaction  HibernateTransaction
  Manager               Manager         Manager
  (JDBC/MyBatis 使用)    (JPA 使用)      (Hibernate 使用)
```

Spring 通过抽象出统一的事务管理接口，屏蔽了不同持久化框架的事务差异。你切换 ORM 框架时，事务管理代码不需要改动。

### 7.2 编程式事务 vs 声明式事务

```java
// 编程式事务：手动控制事务的边界
@Service
public class OrderService {

    private final TransactionTemplate transactionTemplate;
    private final OrderDao orderDao;

    public OrderService(PlatformTransactionManager txManager, OrderDao orderDao) {
        this.transactionTemplate = new TransactionTemplate(txManager);
        this.orderDao = orderDao;
    }

    public void createOrder(Order order) {
        transactionTemplate.executeWithoutResult(status -> {
            try {
                orderDao.insert(order);
                orderDao.updateStock(order.getProductId(), order.getQuantity());
            } catch (Exception e) {
                status.setRollbackOnly(); // 手动标记回滚
                throw e;
            }
        });
    }
}

// 声明式事务：用注解声明，Spring AOP 自动管理
@Service
public class OrderService {

    private final OrderDao orderDao;

    public OrderService(OrderDao orderDao) {
        this.orderDao = orderDao;
    }

    @Transactional // 一个注解搞定！底层通过 AOP 环绕通知实现
    public void createOrder(Order order) {
        orderDao.insert(order);
        orderDao.updateStock(order.getProductId(), order.getQuantity());
        // 正常结束 → 自动提交；抛出运行时异常 → 自动回滚
    }
}
```

**声明式事务更常用**，因为不侵入业务代码。编程式事务在需要细粒度控制（比如一个方法内部分代码要事务、部分不要）时使用。

### 7.3 @Transactional 注解的属性详解

```java
@Transactional(
    propagation = Propagation.REQUIRED,    // 事务传播行为
    isolation = Isolation.DEFAULT,          // 事务隔离级别
    timeout = 30,                           // 超时时间（秒），超时自动回滚
    readOnly = false,                       // 是否只读事务（只读事务可优化性能）
    rollbackFor = Exception.class,          // 哪些异常触发回滚
    noRollbackFor = BusinessException.class,// 哪些异常不回滚
    transactionManager = "txManager"        // 指定事务管理器（多数据源时使用）
)
public void businessMethod() {
    // ...
}
```

### 7.4 事务传播行为（7 种完整讲解）

**什么是传播行为？** 当一个事务方法调用另一个事务方法时，事务应该如何传播（是加入当前事务，还是新起一个事务，还是不用事务）。

#### REQUIRED（默认）

**含义：** 如果当前有事务，就加入它；如果没有，就新建一个。

```
  方法A（有事务）  ──调用──▶  方法B（@Transactional REQUIRED）
                              │
                              ▼
                          B 加入 A 的事务
                          A 和 B 在同一个事务中
                          任一方失败，整体回滚

  方法C（无事务）  ──调用──▶  方法B（@Transactional REQUIRED）
                              │
                              ▼
                          B 自己新建一个事务
```

```java
@Transactional(propagation = Propagation.REQUIRED) // 默认值
public void methodB() {
    // 如果调用者有事务 → 加入调用者的事务
    // 如果调用者没有事务 → 自己创建新事务
}
```

#### REQUIRES_NEW

**含义：** 无论当前有没有事务，都新建一个独立事务。如果当前有事务，先挂起当前事务。

```
  方法A（有事务）  ──调用──▶  方法B（REQUIRES_NEW）
                              │
                              ▼
                          A 的事务被挂起
                          B 创建全新的事务
                          B 提交/回滚不影响 A
                          B 完成后，A 的事务恢复
```

```java
// 典型场景：记录操作日志（即使业务失败，日志也要保存）
@Service
public class OrderService {
    @Autowired
    private LogService logService;

    @Transactional
    public void createOrder(Order order) {
        orderDao.insert(order); // 可能失败
        logService.saveLog("创建订单"); // 即使上面失败，日志也要记录
    }
}

@Service
public class LogService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveLog(String content) {
        // 独立事务，不受外层事务影响
        logDao.insert(content);
    }
}
```

#### NESTED

**含义：** 如果当前有事务，就在当前事务中创建一个"嵌套事务"（保存点）。嵌套事务可以独立回滚到保存点，但最终提交依赖外层事务。

```
  方法A（有事务）  ──调用──▶  方法B（NESTED）
                              │
                              ▼
                          在 A 的事务中创建 Savepoint
                          B 失败 → 回滚到 Savepoint，A 可以继续
                          A 失败 → A 和 B 都回滚
                          A 提交 → B 也一起提交
```

```java
// 与 REQUIRES_NEW 的区别：
// REQUIRES_NEW：完全独立的事务，与外层事务互不影响
// NESTED：依附于外层事务，外层回滚它也回滚，但它回滚不影响外层
```

#### SUPPORTS

**含义：** 如果当前有事务就加入，没有事务就以非事务方式执行。

```java
@Transactional(propagation = Propagation.SUPPORTS)
public User getUser(Long id) {
    // 有事务环境就参与事务（保证一致性读）
    // 没事务环境也能执行（只是普通查询）
    return userDao.findById(id);
}
```

#### NOT_SUPPORTED

**含义：** 以非事务方式执行。如果当前有事务，先挂起当前事务。

```java
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public void sendEmail(String to, String content) {
    // 发送邮件不需要事务，而且可能很耗时
    // 挂起当前事务，避免长时间占用数据库连接
    emailClient.send(to, content);
}
```

#### MANDATORY

**含义：** 必须在已有事务中执行。如果当前没有事务，直接抛出异常。

```java
@Transactional(propagation = Propagation.MANDATORY)
public void deductStock(Long productId, int quantity) {
    // 扣减库存必须在事务中执行（通常由上层事务方法调用）
    // 如果没有事务环境就抛出 IllegalTransactionStateException
    stockDao.deduct(productId, quantity);
}
```

#### NEVER

**含义：** 必须以非事务方式执行。如果当前有事务，直接抛出异常。

```java
@Transactional(propagation = Propagation.NEVER)
public void syncToElasticsearch(Document doc) {
    // 同步到 ES 不应该在事务中执行（避免事务超时）
    // 如果调用者有事务就报错，提醒开发者调整调用方式
    esClient.index(doc);
}
```

**传播行为速查表：**

| 传播行为 | 当前有事务 | 当前无事务 | 核心特点 |
|---------|----------|----------|---------|
| REQUIRED | 加入 | 新建 | 默认，最常用 |
| REQUIRES_NEW | 挂起，新建 | 新建 | 独立事务，互不影响 |
| NESTED | 嵌套（Savepoint） | 新建 | 子事务可独立回滚 |
| SUPPORTS | 加入 | 非事务执行 | 有就参与，没有也行 |
| NOT_SUPPORTED | 挂起 | 非事务执行 | 强制非事务 |
| MANDATORY | 加入 | 抛异常 | 必须有事务 |
| NEVER | 抛异常 | 非事务执行 | 必须无事务 |

### 7.5 事务隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 说明 |
|---------|------|----------|------|------|
| DEFAULT | - | - | - | 使用数据库默认级别（MySQL 默认 RR） |
| READ_UNCOMMITTED | 可能 | 可能 | 可能 | 最低级别，几乎不用 |
| READ_COMMITTED | 不会 | 可能 | 可能 | Oracle 默认 |
| REPEATABLE_READ | 不会 | 不会 | 可能 | MySQL InnoDB 默认 |
| SERIALIZABLE | 不会 | 不会 | 不会 | 最高级别，性能最差 |

```java
// 通常使用 DEFAULT 即可，让数据库决定
@Transactional(isolation = Isolation.DEFAULT)
public void transfer(Long from, Long to, BigDecimal amount) {
    // ...
}
```

### 7.6 事务失效的根本原因及所有场景

**根本原因：** `@Transactional` 是基于 AOP 代理实现的。只有通过代理对象调用的方法，事务才会生效。

#### 场景一：同类方法自调用

```java
@Service
public class OrderService {

    public void createOrder(Order order) {
        // 这里 this 是原始对象，不是代理对象！
        this.insertOrder(order); // 事务不生效！
    }

    @Transactional
    public void insertOrder(Order order) {
        orderDao.insert(order);
    }
}

// 解决方案一：注入自身
@Service
public class OrderService {
    @Autowired
    @Lazy
    private OrderService self;

    public void createOrder(Order order) {
        self.insertOrder(order); // 通过代理对象调用，事务生效
    }

    @Transactional
    public void insertOrder(Order order) {
        orderDao.insert(order);
    }
}

// 解决方案二：拆分到不同的类中
@Service
public class OrderService {
    @Autowired
    private OrderWriteService orderWriteService;

    public void createOrder(Order order) {
        orderWriteService.insertOrder(order); // 不同类，一定走代理
    }
}
```

#### 场景二：方法不是 public

```java
@Service
public class OrderService {

    @Transactional
    void insertOrder(Order order) { // 包级别访问，事务不生效！
        orderDao.insert(order);
    }

    @Transactional
    private void insertOrderPrivate(Order order) { // private 方法，事务不生效！
        orderDao.insert(order);
    }

    @Transactional
    protected void insertOrderProtected(Order order) { // protected 方法，事务不生效！
        orderDao.insert(order);
    }
}
// 解决：将方法改为 public
```

#### 场景三：异常被 catch 吞掉

```java
@Service
public class OrderService {

    @Transactional
    public void createOrder(Order order) {
        try {
            orderDao.insert(order);
            int i = 1 / 0; // 抛出异常
        } catch (Exception e) {
            log.error("出错了", e);
            // 异常被吞掉了！Spring 检测不到异常，不会回滚！
        }
    }
}

// 解决方案一：catch 后重新抛出
// 解决方案二：catch 后手动标记回滚
@Transactional
public void createOrder(Order order) {
    try {
        orderDao.insert(order);
        int i = 1 / 0;
    } catch (Exception e) {
        log.error("出错了", e);
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); // 手动回滚
    }
}
```

#### 场景四：抛出非 RuntimeException

```java
@Service
public class OrderService {

    @Transactional // 默认只对 RuntimeException 和 Error 回滚
    public void createOrder(Order order) throws IOException {
        orderDao.insert(order);
        throw new IOException("文件写入失败"); // checked exception，不会回滚！
    }
}

// 解决：指定 rollbackFor
@Transactional(rollbackFor = Exception.class) // 所有异常都回滚
public void createOrder(Order order) throws IOException {
    orderDao.insert(order);
    throw new IOException("文件写入失败"); // 现在会回滚了
}
```

#### 场景五：数据库引擎不支持事务

```sql
-- MyISAM 引擎不支持事务（只有 InnoDB 支持）
CREATE TABLE orders (...) ENGINE=MyISAM;  -- 事务无效！
CREATE TABLE orders (...) ENGINE=InnoDB;  -- 事务有效
```

#### 场景六：未被 Spring 管理的类

```java
// 手动 new 出来的对象，不受 Spring 管理，没有代理，事务不生效
OrderService orderService = new OrderService();
orderService.createOrder(order); // 事务不生效！
```

**事务失效排查清单：**
1. 方法是否是 `public` 的？
2. 是否存在自调用？
3. 异常是否被 `catch` 了？
4. 异常类型是否是 `RuntimeException` 或 `Error`？是否配置了 `rollbackFor`？
5. 该类是否被 Spring 容器管理？
6. 数据库引擎是否支持事务？

> **一句话总结：** @Transactional 的底层是 AOP 代理，凡是绕过代理的调用（自调用、非 public、手动 new）或者异常未正确传播（被 catch、checked exception），事务都会失效。

---

## 八、循环依赖与三级缓存

### 8.1 什么是循环依赖

```
  ┌───────────┐         ┌───────────┐
  │   Bean A   │ ──依赖──▶ │   Bean B   │
  │           │ ◀──依赖── │           │
  └───────────┘         └───────────┘

  A 创建时需要 B，B 创建时需要 A
  如果不做特殊处理，就会无限递归，最终 StackOverflow
```

### 8.2 Spring 的三级缓存

```java
// 源码位于 DefaultSingletonBeanRegistry 类中
public class DefaultSingletonBeanRegistry {

    // 一级缓存：存放完全初始化好的 Bean（成品）
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>();

    // 二级缓存：存放早期暴露的 Bean（半成品，属性还没填充完）
    private final Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>();

    // 三级缓存：存放 Bean 的工厂对象（ObjectFactory），用于生成早期引用
    private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>();
}
```

### 8.3 三级缓存解决循环依赖的完整流程

**场景：** A 依赖 B，B 依赖 A（都是 singleton + 属性注入）

```
步骤 1：开始创建 A
┌──────────────────────────────────────────────────────────────┐
│  Spring 开始创建 Bean A                                       │
│  1. 实例化 A（调用构造方法），此时 A 是个"空壳"（属性都是 null）  │
│  2. 将 A 的 ObjectFactory 放入三级缓存                        │
│     singletonFactories.put("A", () -> getEarlyBeanReference(A))│
│                                                              │
│  一级缓存：{}                                                 │
│  二级缓存：{}                                                 │
│  三级缓存：{"A": ObjectFactory<A>}                            │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
步骤 2：填充 A 的属性，发现需要 B
┌──────────────────────────────────────────────────────────────┐
│  A 需要注入 B，但容器中还没有 B                                │
│  → 转去创建 B                                                │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
步骤 3：开始创建 B
┌──────────────────────────────────────────────────────────────┐
│  1. 实例化 B（调用构造方法），B 也是"空壳"                      │
│  2. 将 B 的 ObjectFactory 放入三级缓存                        │
│                                                              │
│  一级缓存：{}                                                 │
│  二级缓存：{}                                                 │
│  三级缓存：{"A": ObjectFactory<A>, "B": ObjectFactory<B>}     │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
步骤 4：填充 B 的属性，发现需要 A
┌──────────────────────────────────────────────────────────────┐
│  B 需要注入 A，去缓存中找 A：                                  │
│  1. 一级缓存找 A → 没有                                      │
│  2. 二级缓存找 A → 没有                                      │
│  3. 三级缓存找 A → 找到了 ObjectFactory<A>！                  │
│     调用 ObjectFactory.getObject()                            │
│     → 如果 A 需要 AOP 代理，这里会提前生成代理对象              │
│     → 如果不需要代理，就返回原始的 A 对象                       │
│  4. 将得到的"早期 A"放入二级缓存，从三级缓存移除                 │
│                                                              │
│  一级缓存：{}                                                 │
│  二级缓存：{"A": 早期A对象(可能是代理)}                         │
│  三级缓存：{"B": ObjectFactory<B>}                            │
│                                                              │
│  B 成功获取到 A 的引用（虽然 A 还没完全初始化）                  │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
步骤 5：B 创建完成
┌──────────────────────────────────────────────────────────────┐
│  B 的属性填充完成（A 已注入）                                   │
│  B 继续执行初始化流程（Aware、BeanPostProcessor、init 等）     │
│  B 完全创建好，放入一级缓存                                    │
│                                                              │
│  一级缓存：{"B": 完整的B}                                     │
│  二级缓存：{"A": 早期A对象}                                   │
│  三级缓存：{}                                                 │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
步骤 6：回到 A 的创建流程
┌──────────────────────────────────────────────────────────────┐
│  A 成功获取到 B（从一级缓存）                                  │
│  A 的属性填充完成                                             │
│  A 继续执行初始化流程                                         │
│  A 完全创建好，放入一级缓存，从二级缓存移除                     │
│                                                              │
│  一级缓存：{"A": 完整的A, "B": 完整的B}                       │
│  二级缓存：{}                                                 │
│  三级缓存：{}                                                 │
└──────────────────────────────────────────────────────────────┘
```

### 8.4 为什么需要三级缓存而不是两级？

**核心原因：AOP 代理对象的生成时机问题。**

正常情况下，AOP 代理是在 Bean 初始化完成后（BeanPostProcessor 后置处理阶段）生成的。但在循环依赖场景中，B 在属性填充阶段就需要获取 A 的引用。

**如果只用两级缓存：**
- 要么在实例化后就立即生成代理对象（但此时还没初始化，过早生成代理不合理）
- 要么先给 B 一个原始的 A，等 A 初始化完再替换为代理（但 B 持有的引用无法替换）

**三级缓存的精妙之处：**
- 三级缓存存的是 `ObjectFactory`（工厂），而不是直接存对象
- 只有当真正需要提前获取引用时（循环依赖发生时），才通过工厂获取早期引用
- 工厂中可以判断：如果需要 AOP 代理，就提前生成代理对象返回；不需要代理就返回原始对象
- 这样既避免了不必要的提前代理，又解决了循环依赖中的代理问题

```java
// 三级缓存中存放的 ObjectFactory 实际上是这样的 lambda：
addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));

// getEarlyBeanReference 方法：
protected Object getEarlyBeanReference(String beanName, RootBeanDefinition mbd, Object bean) {
    Object exposedObject = bean;
    // 遍历所有 SmartInstantiationAwareBeanPostProcessor
    // 如果存在 AOP 相关的 Processor，就提前生成代理对象
    for (SmartInstantiationAwareBeanPostProcessor bp : getBeanPostProcessors()) {
        exposedObject = bp.getEarlyBeanReference(exposedObject, beanName);
    }
    return exposedObject;
}
```

**简单来说：** 两级缓存能解决没有 AOP 的循环依赖，三级缓存是为了解决有 AOP 时循环依赖中代理对象的生成时机问题。

### 8.5 为什么构造器注入无法解决循环依赖？

```
创建 A → 调用 A 的构造方法 → 构造方法参数需要 B
       → 创建 B → 调用 B 的构造方法 → 构造方法参数需要 A
              → 创建 A → 调用 A 的构造方法 → ...（死循环！）
```

**原因：** 三级缓存的解决方案依赖于"先创建空壳对象，再填充属性"的两步过程。但构造器注入时，实例化（调用构造方法）和注入是同一步——构造方法参数就是依赖，不提供参数就无法创建对象，也就没有"空壳"可以提前暴露。

**解决方案：** 使用 `@Lazy` 注解

```java
@Service
public class A {
    private final B b;

    public A(@Lazy B b) { // @Lazy 会注入一个 B 的代理对象（不会立即创建真实的 B）
        this.b = b;        // 只有在真正调用 b 的方法时，才会触发 B 的创建
    }
}
```

### 8.6 Spring Boot 2.6+ 默认禁止循环依赖

从 Spring Boot 2.6 开始，默认不允许循环依赖（`spring.main.allow-circular-references=false`）。

**为什么要禁止？**
- 循环依赖通常意味着设计问题，类之间的职责划分不清晰
- 依赖三级缓存解决循环依赖会增加复杂度和隐性风险
- 提前暴露的"半成品 Bean"可能导致难以排查的 Bug

**如果确实需要，可以手动开启：**
```yaml
spring:
  main:
    allow-circular-references: true  # 不推荐，应该重构代码消除循环依赖
```

> **一句话总结：** Spring 通过三级缓存（成品池、半成品池、工厂池）解决 singleton + 属性注入的循环依赖，三级缓存的核心价值在于解决 AOP 代理对象的提前创建问题，构造器注入因为无法产生"空壳对象"所以无法解决循环依赖。

---

## 九、Spring 中的设计模式

### 9.1 工厂模式：BeanFactory

**模式说明：** 工厂模式封装了对象的创建过程，客户端不需要知道具体的创建逻辑。

**Spring 中的体现：**

```java
// BeanFactory 就是一个大工厂，负责创建和管理所有的 Bean
// 你不需要自己 new 对象，只需要告诉工厂你要什么
ApplicationContext context = SpringApplication.run(MyApp.class, args);
UserService userService = context.getBean(UserService.class); // 工厂帮你创建

// 此外，FactoryBean 接口让你可以自定义复杂对象的创建逻辑
@Component
public class ConnectionFactoryBean implements FactoryBean<Connection> {
    @Override
    public Connection getObject() throws Exception {
        // 复杂的创建逻辑...
        return DriverManager.getConnection(url, username, password);
    }

    @Override
    public Class<?> getObjectType() {
        return Connection.class;
    }
}
// 通过 getBean("connectionFactoryBean") 获取的是 Connection 对象
// 通过 getBean("&connectionFactoryBean") 获取的是 FactoryBean 本身
```

### 9.2 单例模式：Bean 默认单例

**模式说明：** 确保一个类只有一个实例。

**Spring 的实现方式不同于传统单例：**

```java
// 传统单例：通过双重检查锁实现（类级别的单例）
public class TraditionalSingleton {
    private static volatile TraditionalSingleton instance;
    private TraditionalSingleton() {}
    public static TraditionalSingleton getInstance() {
        if (instance == null) {
            synchronized (TraditionalSingleton.class) {
                if (instance == null) {
                    instance = new TraditionalSingleton();
                }
            }
        }
        return instance;
    }
}

// Spring 单例：通过单例注册表（ConcurrentHashMap）实现（容器级别的单例）
// 源码在 DefaultSingletonBeanRegistry 中：
// private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);
// 每个 Bean 在容器中只有一个实例，但这个类本身并不是传统意义上的单例类
```

### 9.3 代理模式：AOP 动态代理

**模式说明：** 为目标对象提供一个替身（代理），在不修改目标对象的情况下增强其功能。

```java
// Spring AOP 就是代理模式的典型应用
// 当你写下 @Transactional 时，Spring 会为你的 Service 创建一个代理对象
// 这个代理对象"伪装"成你的 Service，在方法调用前后加入事务管理逻辑

@Service
public class UserService {
    @Transactional
    public void updateUser(User user) {
        userDao.update(user);
    }
}

// 实际被注入到 Controller 中的不是 UserService 原始对象
// 而是 Spring 生成的代理对象，大致等价于：
// class UserServiceProxy extends UserService {
//     void updateUser(User user) {
//         开启事务();
//         try {
//             super.updateUser(user);  // 调用真实方法
//             提交事务();
//         } catch (Exception e) {
//             回滚事务();
//             throw e;
//         }
//     }
// }
```

### 9.4 模板方法模式：JdbcTemplate / RestTemplate

**模式说明：** 定义算法的骨架，将某些步骤延迟到子类实现。父类控制流程，子类实现细节。

```java
// JdbcTemplate 封装了 JDBC 操作的模板流程：
// 获取连接 → 创建 Statement → 执行 SQL → 处理结果 → 关闭连接
// 你只需要提供"变化的部分"（SQL 和结果处理逻辑）

@Repository
public class UserDao {
    private final JdbcTemplate jdbcTemplate;

    public UserDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public User findById(Long id) {
        // 你只关心 SQL 和结果映射，其他的（连接管理、异常处理）全部由模板处理
        return jdbcTemplate.queryForObject(
            "SELECT * FROM users WHERE id = ?",
            (rs, rowNum) -> new User(rs.getLong("id"), rs.getString("name")),
            id
        );
    }
}
```

### 9.5 观察者模式：ApplicationEvent / ApplicationListener

**模式说明：** 当一个对象状态变化时，自动通知所有关注它的对象。

```java
// 1. 定义事件
public class OrderCreatedEvent extends ApplicationEvent {
    private final Long orderId;

    public OrderCreatedEvent(Object source, Long orderId) {
        super(source);
        this.orderId = orderId;
    }

    public Long getOrderId() { return orderId; }
}

// 2. 发布事件
@Service
public class OrderService {
    private final ApplicationEventPublisher eventPublisher;

    public OrderService(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void createOrder(Order order) {
        orderDao.insert(order);
        // 发布事件，不需要知道谁来处理
        eventPublisher.publishEvent(new OrderCreatedEvent(this, order.getId()));
    }
}

// 3. 监听事件（可以有多个监听器）
@Component
public class SmsNotificationListener {
    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        // 发送短信通知...
        System.out.println("发送短信：订单 " + event.getOrderId() + " 已创建");
    }
}

@Component
public class InventoryListener {
    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        // 扣减库存...
        System.out.println("扣减库存：订单 " + event.getOrderId());
    }
}
```

### 9.6 策略模式：Resource 接口

**模式说明：** 定义一组算法，将每个算法封装起来，使它们可以互相替换。

```java
// Resource 接口有多种实现，根据不同的资源位置采用不同的加载策略
// Spring 根据路径前缀自动选择合适的实现

Resource resource1 = new ClassPathResource("config.yml");       // classpath 下
Resource resource2 = new FileSystemResource("/etc/app/config"); // 文件系统
Resource resource3 = new UrlResource("https://example.com/cfg"); // 网络资源

// ResourceLoader 根据前缀自动选择策略：
// "classpath:" → ClassPathResource
// "file:"      → FileSystemResource
// "http:"      → UrlResource
```

### 9.7 适配器模式：HandlerAdapter

**模式说明：** 将一个接口转换为客户端期望的另一个接口，使不兼容的接口能一起工作。

```java
// DispatcherServlet 需要统一的方式调用各种类型的 Handler
// 但 Handler 可能是 @Controller 方法、可能是实现了 Controller 接口的类...
// HandlerAdapter 将不同类型的 Handler "适配" 为统一的调用方式

// DispatcherServlet 中的代码：
HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());
// 无论 Handler 是什么类型，都通过 ha.handle() 统一调用
ModelAndView mv = ha.handle(request, response, mappedHandler.getHandler());
```

### 9.8 责任链模式：Filter / Interceptor

**模式说明：** 多个处理器形成链条，每个处理器决定是否处理请求或传递给下一个。

```java
// Filter 链是典型的责任链模式
// 每个 Filter 可以决定是继续传递还是中断

@Component
@Order(1)
public class AuthFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {
        // 前置处理
        if (isAuthenticated(request)) {
            chain.doFilter(request, response); // 传递给下一个 Filter
        } else {
            // 认证失败，中断链条，直接返回 401
            ((HttpServletResponse) response).setStatus(401);
        }
        // 后置处理
    }
}

@Component
@Order(2)
public class LogFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {
        long start = System.currentTimeMillis();
        chain.doFilter(request, response); // 传递给下一个
        long cost = System.currentTimeMillis() - start;
        log.info("请求耗时：{}ms", cost);
    }
}
```

**Spring 中设计模式总览表：**

| 设计模式 | Spring 中的体现 | 核心价值 |
|---------|----------------|---------|
| 工厂模式 | BeanFactory / FactoryBean | 封装对象创建，解耦 |
| 单例模式 | 单例注册表（singletonObjects） | 节省资源，共享实例 |
| 代理模式 | AOP 动态代理 | 无侵入式增强 |
| 模板方法 | JdbcTemplate / RestTemplate | 封装流程，聚焦变化 |
| 观察者模式 | ApplicationEvent / Listener | 事件驱动，松耦合 |
| 策略模式 | Resource / HandlerMapping | 灵活切换算法 |
| 适配器模式 | HandlerAdapter | 统一不同接口 |
| 责任链模式 | Filter / Interceptor | 链式处理，可扩展 |

---

## 十、Spring Boot 启动流程

### 10.1 SpringApplication.run() 做了什么

```java
@SpringBootApplication
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

**完整启动流程：**

```
SpringApplication.run()
│
├── 第一步：创建 SpringApplication 对象
│   │
│   ├── 推断应用类型（SERVLET / REACTIVE / NONE）
│   │   → 通过检测 classpath 中是否存在特定类来判断
│   │   → 有 DispatcherServlet → SERVLET 类型
│   │   → 有 DispatcherHandler → REACTIVE 类型
│   │
│   ├── 加载 ApplicationContextInitializer（上下文初始化器）
│   │   → 从 spring.factories / .imports 中读取
│   │
│   ├── 加载 ApplicationListener（应用事件监听器）
│   │   → 从 spring.factories / .imports 中读取
│   │
│   └── 推断主类（找到包含 main 方法的类）
│
├── 第二步：运行 run() 方法
│   │
│   ├── 2.1 创建 BootstrapContext（引导上下文）
│   │
│   ├── 2.2 获取 SpringApplicationRunListeners
│   │   → 用于在启动各阶段发布事件
│   │
│   ├── 2.3 发布 ApplicationStartingEvent
│   │   → "应用开始启动了"
│   │
│   ├── 2.4 准备 Environment（环境对象）
│   │   ├── 解析命令行参数
│   │   ├── 加载 application.yml / application.properties
│   │   ├── 加载系统环境变量、JVM 参数
│   │   ├── Profile 激活（dev / test / prod）
│   │   └── 发布 ApplicationEnvironmentPreparedEvent
│   │
│   ├── 2.5 打印 Banner（那个 Spring 的大 Logo）
│   │
│   ├── 2.6 创建 ApplicationContext（应用上下文）
│   │   → 根据应用类型创建对应的上下文实现类
│   │   → SERVLET 类型 → AnnotationConfigServletWebServerApplicationContext
│   │
│   ├── 2.7 准备上下文（prepareContext）
│   │   ├── 将 Environment 设置到上下文
│   │   ├── 执行 ApplicationContextInitializer
│   │   ├── 发布 ApplicationContextInitializedEvent
│   │   ├── 注册启动类的 BeanDefinition
│   │   └── 发布 ApplicationPreparedEvent
│   │
│   ├── 2.8 刷新上下文（refreshContext）—— 核心中的核心！
│   │   ├── 调用 AbstractApplicationContext.refresh()
│   │   ├── 注册 BeanFactoryPostProcessor 并执行
│   │   │   → ConfigurationClassPostProcessor 处理 @Configuration
│   │   │   → 解析 @ComponentScan → 扫描所有 Bean
│   │   │   → 解析 @Import → 加载自动配置类
│   │   │   → 处理 @Bean 方法
│   │   ├── 注册 BeanPostProcessor
│   │   ├── 初始化国际化、事件广播器
│   │   ├── 创建嵌入式 Web 服务器（Tomcat / Jetty / Undertow）
│   │   ├── 实例化所有非懒加载的 singleton Bean
│   │   │   → 包括自动配置类创建的 Bean
│   │   │   → 包括你自己写的 @Service / @Controller 等
│   │   └── 启动 Web 服务器
│   │
│   ├── 2.9 发布 ApplicationStartedEvent
│   │   → "所有 Bean 创建完毕，Web 服务器已启动"
│   │
│   ├── 2.10 执行 Runner
│   │   ├── 执行所有 ApplicationRunner
│   │   └── 执行所有 CommandLineRunner
│   │   → 适合在启动后执行初始化逻辑
│   │
│   └── 2.11 发布 ApplicationReadyEvent
│       → "应用已完全就绪，可以接收请求了"
│
└── 完成！应用已启动
```

### 10.2 嵌入式 Tomcat 是怎么启动的

```
refresh() 方法中的 onRefresh() 阶段
│
├── ServletWebServerApplicationContext.onRefresh()
│   └── createWebServer()
│       │
│       ├── 从容器中获取 ServletWebServerFactory
│       │   → 自动配置已经注册了 TomcatServletWebServerFactory
│       │   → 如果你引入了 spring-boot-starter-web，默认就是 Tomcat
│       │
│       ├── TomcatServletWebServerFactory.getWebServer()
│       │   ├── 创建 Tomcat 实例
│       │   ├── 创建 Connector（默认端口 8080）
│       │   ├── 创建 Host / Engine
│       │   ├── 将 DispatcherServlet 注册到 Tomcat
│       │   └── 返回 TomcatWebServer
│       │
│       └── TomcatWebServer.start()
│           → Tomcat 开始监听端口，接收 HTTP 请求
```

**为什么不需要外部 Tomcat？** 因为 Spring Boot 将 Tomcat 作为一个内嵌的 Java 库引入，通过代码方式启动，而不是以 WAR 包部署到外部 Tomcat 容器中。这就是 Spring Boot 能打成可执行 JAR 的关键。

```java
// 如果想切换为 Jetty 或 Undertow：
// 1. 排除 Tomcat
// <exclusion>spring-boot-starter-tomcat</exclusion>
// 2. 引入 Jetty
// <dependency>spring-boot-starter-jetty</dependency>
// 自动配置会根据 classpath 中的类自动选择对应的 WebServerFactory
```

### 10.3 启动过程中的核心事件

```
ApplicationStartingEvent         应用开始启动（几乎最早）
        │
        ▼
ApplicationEnvironmentPreparedEvent   Environment 准备好（配置文件已加载）
        │
        ▼
ApplicationContextInitializedEvent    ApplicationContext 创建并初始化完成
        │
        ▼
ApplicationPreparedEvent              Bean 定义加载完成，但还没创建 Bean
        │
        ▼
ContextRefreshedEvent                 上下文刷新完成（所有 Bean 创建完毕）
        │
        ▼
ApplicationStartedEvent               应用启动完成
        │
        ▼
ApplicationReadyEvent                 应用已就绪（Runner 也执行完了）
        │
        ▼
ApplicationFailedEvent                启动失败时触发（如果发生异常）
```

```java
// 监听启动事件的示例
@Component
public class StartupListener {

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        System.out.println("应用已就绪，可以开始处理请求了！");
        // 适合做一些启动后的初始化工作
    }
}

// 或者使用 CommandLineRunner / ApplicationRunner
@Component
public class DataInitRunner implements CommandLineRunner {
    @Override
    public void run(String... args) throws Exception {
        System.out.println("初始化基础数据...");
        // 在所有 Bean 创建完成后执行
    }
}
```

### 10.4 启动速度优化方案

| 优化方案 | 说明 | 效果 |
|---------|------|------|
| 懒加载 | `spring.main.lazy-initialization=true` | 启动快，但首次请求慢 |
| 减少包扫描范围 | 精确指定 `@ComponentScan` 的 basePackages | 减少扫描耗时 |
| 排除不需要的自动配置 | `@SpringBootApplication(exclude=...)` | 减少不必要的 Bean 创建 |
| 使用 Spring AOT | Spring Boot 3.x 支持 Ahead-of-Time 编译 | 大幅减少启动时间 |
| GraalVM Native Image | 编译为原生镜像 | 启动时间降到毫秒级 |
| JVM 参数优化 | `-XX:TieredStopAtLevel=1` | 减少 JIT 编译时间 |
| 关闭 JMX | `spring.jmx.enabled=false` | 减少 MBean 注册 |

```java
// 排除不需要的自动配置
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,     // 不用数据库就排除
    SecurityAutoConfiguration.class,       // 不用安全框架就排除
    MailSenderAutoConfiguration.class      // 不发邮件就排除
})
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

```yaml
# 开发环境开启懒加载，加速启动
spring:
  main:
    lazy-initialization: true  # 所有 Bean 延迟到第一次使用时才创建
```

> **一句话总结：** Spring Boot 启动的核心就是 `SpringApplication.run()` → 准备 Environment → 创建 ApplicationContext → 刷新上下文（扫描 Bean + 自动配置 + 创建 Bean + 启动内嵌 Tomcat）→ 发布 Ready 事件，整个过程通过事件机制让各组件在正确的时机被初始化。

---

## 附录：常见面试连环问

**Q1：Spring 和 Spring Boot 的关系？**
Spring 是基础框架（IoC + AOP + MVC 等），Spring Boot 是在 Spring 基础上提供了自动配置、Starter 机制和嵌入式服务器，让 Spring 应用"开箱即用"。

**Q2：@Configuration 和 @Component 的区别？**
`@Configuration` 标注的类中的 `@Bean` 方法会被 CGLIB 代理增强，保证 Bean 的单例性（方法间互相调用也是同一个实例）。`@Component` 类中的 `@Bean` 方法是"Lite 模式"，不保证单例。

**Q3：Spring Boot 3.x 和 2.x 的核心区别？**
- Java 基线从 8 提升到 17
- Jakarta EE 9+（`javax.*` → `jakarta.*`）
- 自动配置注册从 `spring.factories` 迁移到 `AutoConfiguration.imports`
- 原生 GraalVM 支持
- 内置可观测性（Micrometer + Tracing）

**Q4：如何理解"约定优于配置"？**
Spring Boot 为大多数场景提供了合理的默认配置（约定）。比如引入 `spring-boot-starter-web` 后，默认端口 8080、默认 Jackson 序列化、默认 Tomcat 容器。你只需要在不满意默认值时才去修改配置，大大减少了配置工作量。

---

> 全文完。建议学习路径：IoC/DI（基础） → Bean 生命周期 → AOP → 自动配置 → 事务管理 → 循环依赖 → 启动流程 → 设计模式（串联）。
