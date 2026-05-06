# Spring 面试题

---

## 1. Spring IoC 容器启动与 Bean 生命周期

❓ **题目：** 请描述 Spring IoC 容器的启动过程，以及一个 Bean 从创建到销毁的完整生命周期。

💡 **答案：**

Spring IoC 容器启动的核心流程可以概括为：资源定位 → 加载解析 → 注册 BeanDefinition → 实例化 → 属性填充 → 初始化。具体来说是，容器首先通过 BeanDefinitionReader 读取配置文件或扫描注解，将每个 Bean 的元数据封装成 BeanDefinition 并注册到 BeanDefinitionRegistry。然后通过 BeanFactoryPostProcessor 对 BeanDefinition 进行后置处理（比如 `${}` 占位符替换）。之后才是真正地实例化 Bean，这一步通常通过反射调用构造器完成，然后是属性注入（`@Autowired`、`@Value` 等），最后执行初始化回调。对于单例 Bean，初始化完成后会放入一级缓存（单例池）供后续使用。容器关闭时会销毁单例 Bean，调用 `@PreDestroy`、`DisposableBean.destroy()` 或 `destroy-method`。

**追问1：** Spring 如何解决循环依赖？为什么三级缓存是必要的，二级缓存够吗？

Spring 解决循环依赖的核心是三级缓存，缺一不可。一级缓存（singletonObjects）存放完全创建好的单例 Bean；二级缓存（earlySingletonObjects）存放早期暴露的 Bean 引用；三级缓存（singletonFactories）存放能产生早期引用的 ObjectFactory。流程是：A 创建时把自己注册到三级缓存，然后注入属性，发现需要 B；B 创建时同样注册到三级缓存，然后注入属性，发现需要 A；B 从三级缓存拿到 A 的 ObjectFactory，调用它拿到 A 的早期引用，把 A 升级到二级缓存，B 完成创建进入一级缓存；A 拿到 B 完成创建也进入一级缓存。

二级缓存不够，是因为 Spring 的 AOP 动态代理在这个环节有特殊需求。如果只用二级缓存，当 A 需要被 AOP 增强时，B 注入的 A 到底是原始对象还是代理对象？三级缓存的 ObjectFactory 提供了"延迟决定"的能力——在真正需要注入的时候调用 `getEarlyBeanReference` 方法，如果这个 Bean 需要代理，此时返回代理对象；不需要就返回原始对象。这个判断时机必须在属性填充之前、循环依赖发生时，所以三级缓存实际上是为了 AOP 代理服务的。

**追问2：** `@PostConstruct`、`InitializingBean.afterPropertiesSet()`、`init-method` 三者的执行顺序是怎样的？为什么这么设计？

执行顺序是 `@PostConstruct` → `afterPropertiesSet()` → `init-method`。这么设计的原因是 Spring 希望保持对 JSR-250 规范的支持同时又兼容自己的扩展机制。`@PostConstruct` 是 Java 标准注解，优先级最高，最先执行。`InitializingBean.afterPropertiesSet()` 是 Spring 自己的接口，紧耦合于 Spring 框架，次之执行。`init-method` 是 XML 配置或 `@Bean(initMethod=...)` 指定的方法，最后执行，给用户最大的灵活性。三者虽然都能完成初始化逻辑，但在实际项目中推荐使用 `@PostConstruct`，因为它是标准注解，与 Spring 框架解耦，日后迁移成本更低。

📌 **易错点 / 加分项：**
- 构造器注入的循环依赖无法解决，会抛 `BeanCurrentlyInCreationException`
- 多例（prototype）Bean Spring 不解决循环依赖
- `@PostConstruct` 需要 `CommonAnnotationBeanPostProcessor` 来解析执行

---

## 2. Spring 事务传播机制详解

❓ **题目：** Spring 声明式事务的传播行为有哪些？请重点说明 `REQUIRED` 和 `REQUIRES_NEW` 的区别以及各自适用的业务场景。

💡 **答案：**

Spring 定义了七种事务传播行为，其中最常用也是面试重点的是 `REQUIRED` 和 `REQUIRES_NEW`。`REQUIRED`（默认）的意思是：如果当前存在事务就加入这个事务，如果不存在就新建一个事务。它适用于大多数业务场景——比如下单时扣库存、扣余额、生成订单这三个操作应该在同一个事务中，要么全成功要么全回滚。`REQUIRES_NEW` 的行为完全不同：不管当前有没有事务，它都会新建一个事务，并且如果当前有事务，就把当前事务挂起。比如说下单时我们需要记录一条操作日志，日志写入不可以因为主流程回滚而丢失——不管下单成功还是失败，日志都要落库。这时候日志方法用 `REQUIRES_NEW`，它独立于主事务提交，主事务回滚不会影响它。

**追问1：** `REQUIRES_NEW` 真的会挂起当前事务吗？底层是如何实现的？

是的，`REQUIRES_NEW` 确实会挂起当前事务。底层是通过 `PlatformTransactionManager` 的 `suspend()` 和 `resume()` 方法实现的。以 JDBC 为例，挂起事务的本质是：把当前线程持有的数据库连接（Connection）解绑并暂存起来，同时为新事务获取一个新的数据库连接（因为一个连接同时只能有一个事务）。新事务在新的连接上执行、提交或回滚，然后恢复原来挂起的事务，将原来的连接重新绑定到当前线程上。这个过程中涉及物理连接切换，如果连接池不够大，频繁的 `REQUIRES_NEW` 可能导致连接耗尽。

**追问2：** 在同一个 Service 类中，非事务方法直接调用 `@Transactional` 方法，事务会生效吗？为什么？

不会生效。原因在于 Spring 事务的底层实现是 AOP 代理。`@Transactional` 是通过生成代理对象来实现的——当你从容器中拿到 Bean 时，拿到的实际是代理对象，调用代理对象的方法时，代理会先执行事务切面逻辑再调用目标方法。但在同一个类内部，this 调用直接调用的是目标对象的方法，绕过了代理，事务切面根本没有机会执行。解决方案有三种：一是将事务方法抽取到另一个 Bean 中，通过注入的方式调用；二是通过 `AopContext.currentProxy()` 获取当前代理对象来调用；三是在配置类上加 `@EnableAspectJAutoProxy(exposeProxy = true)` 并结合 `((XxxService)AopContext.currentProxy()).method()` 来调用。

📌 **易错点 / 加分项：**
- 类内部调用事务失效是高频坑，务必结合 AOP 原理解释清楚
- `REQUIRES_NEW` 和 `NESTED` 的区别：前者完全独立事务，后者是父事务的子事务，父事务回滚子事务也回滚
- 能提到 `TransactionSynchronizationManager` 在背后管理事务资源的话会是加分项

---

## 3. Spring Bean 的作用域与作用域依赖问题

❓ **题目：** Spring 的 Bean 有哪几种作用域？当一个单例 Bean 依赖一个多例 Bean 时会发生什么问题？如何解决？

💡 **答案：**

Spring 定义了五种作用域：`singleton`（单例，整个 IoC 容器中只有一个实例，默认作用域）、`prototype`（多例，每次获取都创建新实例）、`request`（每个 HTTP 请求一个实例）、`session`（每个 HTTP Session 一个实例）、`application`（ServletContext 级别，全局唯一）。当单例 Bean 依赖多例 Bean 时会出现一个经典问题：单例 Bean 在容器启动时只创建一次，它依赖的多例 Bean 也在创建时被注入一次，之后每次从单例 Bean 中获取多例 Bean 拿到的都是同一个实例，多例的效果就丢失了。比如一个单例 Controller 注入了多例的 Service（业务上需要每次请求独立的 Service 实例），但实际上每次拿到的都是同一个。解决方案有三种：一是实现 `ApplicationContextAware` 接口，每次通过 `context.getBean()` 手动获取；二是使用 `@Lookup` 注解，Spring 通过 CGLIB 动态代理让该方法每次都从容器获取新实例；三是在注入点用 `ObjectFactory` 或 `Provider` 来延迟获取。

**追问1：** Request 作用域和 Session 作用域在 Web 应用中非常常见，Spring 是如何在 request 开始时自动创建这些 Bean 的？背后的机制是什么？

Request 和 Session 作用域属于"作用域代理"的经典应用场景。它们的生命周期不由 Spring IoC 容器管理，而是绑定在 Web 容器的 request/session 上。Spring 的实现原理：当定义一个 request 作用域的 Bean 时，Spring 不会直接在启动时创建它（因为此时还没有 request），而是注入一个代理对象（默认 CGLIB 或 JDK 动态代理）。当单例 Bean 调用代理对象的方法时，代理会拦截调用，从当前线程绑定的 `RequestAttributes` 中取出当前请求对象，然后用 request 作为 key 去 `AbstractRequestAttributesScope` 维护的 map 中查找实例——如果当前 request 没有这个 Bean 就创建新的，有就直接返回。这依赖的核心机制是 `RequestContextHolder`，底层用 ThreadLocal 绑定请求上下文。也就是说，虽然注入点看起来是普通字段，但拿到的实际上是代理，代理在运行时根据当前线程绑定的 request 来路由到对应的实际实例。

📌 **易错点 / 加分项：**
- 单例依赖多例的问题本质是"依赖注入只在容器初始化时发生一次"，这和 Spring 的 IoC 容器设计有关
- `@Lookup` 注解是 Spring 专门用来解决这个问题的，底层通过 CGLIB 生成子类实现
- Request/Session 作用域在非 Web 环境下不能使用，会直接抛出异常

---

## 4. Spring Boot 自动配置原理

❓ **题目：** Spring Boot 的自动配置是如何实现的？`@SpringBootApplication` 注解内部包含了哪些关键注解？

💡 **答案：**

Spring Boot 自动配置的核心机制是三层组合：`@SpringBootApplication` 是一个组合注解，内部包含 `@SpringBootConfiguration`（等同于 `@Configuration`）、`@EnableAutoConfiguration` 和 `@ComponentScan`。`@EnableAutoConfiguration` 是自动配置的入口，它通过 `@Import(AutoConfigurationImportSelector.class)` 导入选择器，选择器会读取 classpath 下所有 jar 包中的 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`（Spring Boot 3.x）或 `META-INF/spring.factories`（Spring Boot 2.x）文件中配置的自动配置类全限定名。这些自动配置类通常带有 `@ConditionalOnClass`、`@ConditionalOnMissingBean` 等条件注解，Spring Boot 逐个评估条件是否满足，满足的配置类就会生效。比如 classpath 下有 `DataSource` 类且容器中没有用户自定义的 DataSource Bean，`DataSourceAutoConfiguration` 就会创建默认的 DataSource。`@ComponentScan` 负责扫描当前包及其子包下的组件。

**追问1：** 如果你想自定义一个 Starter，需要做哪些事？自定义的自动配置类是如何被 Spring Boot 发现和加载的？

自定义一个 Starter 的步骤：第一步，创建一个 autoconfigure 模块，编写自动配置类，用 `@Configuration` + `@Bean` 定义组件的默认创建逻辑，并用 `@ConditionalOnClass`（classpath 下有相应类时生效）、`@ConditionalOnMissingBean`（用户未自定义时生效）、`@ConditionalOnProperty`（按配置开关）等条件注解控制生效条件。第二步，在 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 文件中写入自动配置类的全限定名，这是 Spring Boot 3.x 的新规范（`spring.factories` 在 3.x 中已被标记废弃，只保留向后兼容）。第三步，通过 `@ConfigurationProperties(prefix = "xxx")` 定义配置属性类，让用户可以在 `application.yml` 中对组件进行参数化配置。第四步，创建一个 starter 模块（它本身只是一个空 jar，通过 `pom.xml` 依赖 autoconfigure 模块和所需的第三方库），用户只要引入这个 starter，classpath 就自动具备了需要的类和自动配置。第五步，在 starter 模块中加入 `spring-boot-configuration-processor` 依赖，编译时生成 `spring-configuration-metadata.json`，让 IDE 有自动提示。

📌 **易错点 / 加分项：**
- Spring Boot 2.x 用 `spring.factories`，3.x 用 `AutoConfiguration.imports`，这个演进反映了自动配置机制的简化
- `@ConditionalOnBean` 有坑——它的判断顺序取决于 Bean 的创建顺序，可能因为顺序问题导致误判
- `spring-boot-starter` 和 `spring-boot-starter-web` 的区别：前者只包含核心 starter，后者包含 web 相关

---

## 5. Spring AOP 代理方式与应用场景

❓ **题目：** Spring AOP 的 JDK 动态代理和 CGLIB 代理有什么区别？Spring Boot 3.x 默认使用哪种代理？

💡 **答案：**

JDK 动态代理和 CGLIB 代理的底层实现完全不同。JDK 动态代理基于反射和接口实现——它在运行时动态生成一个实现目标接口的代理类，拦截方法调用后通过 `InvocationHandler.invoke` 转发，核心限制是目标类必须实现至少一个接口。CGLIB 基于字节码增强——它在运行时动态生成目标类的子类，通过 ASM 字节码框架重写父类方法，在方法中插入拦截逻辑。CGLIB 的限制是目标类不能是 final，被代理的方法不能是 final（因为 final 方法无法被子类重写），也不能是 private（private 方法 CGLIB 看不到）。Spring Boot 2.x 时代默认还是 JDK 代理，只在没有接口时用 CGLIB；Spring Boot 3.x 开始默认强制使用 CGLIB，因为它的 `proxyBeanMethods` 默认 true 用 CGLIB 可以处理类的内部调用问题，而且 CGLIB 的性能在现代版本中已经非常接近 JDK 代理。

**追问1：** AOP 切面的执行顺序可以控制吗？如果一个方法被多个切面拦截，执行顺序是怎样的？

可以控制，通过 `@Order` 注解来指定切面优先级。数值越小优先级越高。多个切面拦截同一个方法时形成"同心圆"的结构：优先级最高的切面在最外层，先执行"前置"通知，最后执行"后置"和"返回"通知（就像一个栈——前置按优先级正序执行，后置/返回/异常按优先级逆序执行）。也可以实现 `Ordered` 接口来设置顺序。不带 `@Order` 的切面执行顺序是不确定的。

**追问2：** `@Transactional` 事务注解是一个 AOP 切面，它的优先级比用户自定义切面高还是低？如果自定义切面里抛了异常，事务会回滚吗？

`@Transactional` 的事务切面由 `TransactionInterceptor` 实现，Spring 内部将其注册在 `Ordered.LOWEST_PRECEDENCE` 附近（事务切面的优先级很低，通常在所有自定义切面之后执行）。这意味着自定义切面通常包裹在事务切面的外层。如果自定义切面抛了异常，这个异常会在进入事务切面之前被抛出，所以事务逻辑根本没执行，也就不存在回滚的问题——事务还没开始。如果自定义切面在返回后抛异常（AfterThrowing），事务已经提交了，异常不会触发回滚。如果自定义切面的前置通知抛异常，事务切面还没运行，同样无所谓回滚。这里面比较微妙的是：如果你的切面在事务切面内部（order 设得比事务更大），且你的 AfterThrowing 抛了异常但事务的 AfterThrowing 还没执行，可能会导致事务回滚，但代码顺序非常绕，不建议这样玩。

📌 **易错点 / 加分项：**
- Spring AOP 只拦截 public 方法，private 和 protected 默认不经过代理
- CGLIB 生成的子类内部 `this` 调用不走代理，这又回到了事务失效那个坑
- AOP 的 `@Around` 可以实现"控制是否执行原方法"，这是其他通知做不到的

---

## 6. Spring 循环依赖与三级缓存

❓ **题目：** Spring 如何通过三级缓存解决单例 Bean 的循环依赖？为什么不能解决构造器注入的循环依赖？

💡 **答案：**

三级缓存的核心设计是：一级缓存 `singletonObjects` 放完整的单例 Bean；二级缓存 `earlySingletonObjects` 放已经执行过 `getEarlyBeanReference` 的"早期引用"；三级缓存 `singletonFactories` 放 ObjectFactory，它是延迟触发的——只在真正需要时才调用生成早期引用。流程为：Bean A 实例化后，将自己包装成 ObjectFactory 注册到三级缓存；然后属性填充，需要注入 B；B 实例化，同样注册到三级缓存；B 属性填充需要注入 A，从三级缓存找到 A 的 ObjectFactory，调用它获得 A 的早期引用，放入二级缓存并从三级缓存删除；B 完成属性填充和初始化，进入一级缓存；A 拿到 B 完成属性填充和初始化，进入一级缓存并删除二级缓存中的早期引用。构造器注入无法解决的根因：构造器注入发生在实例化阶段（调用构造方法创建对象），此时 Bean 还没有被构造出来，自然无法被注册到任何缓存中——三级缓存的入口是"实例化后、属性填充前"，如果连实例化都卡在循环依赖中，那就是死锁。

**追问1：** 如果不用 AOP 代理，二级缓存是否足够？三级缓存的 ObjectFactory 究竟解决了什么问题？

二级缓存确实不够，但原因不是纯粹为了性能。关键在于 Spring AOP 动态代理的时机。一个需要 AOP 增强的 Bean A，它的代理对象可能在初始化阶段的 `BeanPostProcessor` 里才创建，而循环依赖需要在属性填充阶段就暴露出来。如果只有二级缓存，B 在属性填充时拿到的 A 只能是原始对象——如果 A 需要 AOP 增强，B 持有的 A 应该是代理对象而不是原始对象。三级缓存的 ObjectFactory 解决了这个"延迟决定"的问题：ObjectFactory 在被调用时才调用 `getEarlyBeanReference`，如果 A 需要 AOP 增强，这个方法会提前创建代理对象返回给 B；如果不需要，返回原始对象。这就把"是否创建代理、什么时候创建"的决定推迟到了需要的时候，而不是在 A 实例化那一刻就定了。

📌 **易错点 / 加分项：**
- prototype 作用域不解决循环依赖，会抛异常
- 如果 B 的 ObjectFactory 在三级缓存中没有被 A 消费，B 初始化完成后会把三级缓存清除——二级缓存只是中转站
- 能讲清楚 `addSingletonFactory`、`getSingleton`、`addSingleton` 这三个核心方法各自操作哪些缓存会加分
