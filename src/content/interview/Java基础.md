# Java基础 面试题

---

## 1. HashMap 底层原理与 JDK 演进

❓ **题目：** 请详细说明 HashMap 的数据结构，以及 put 和 get 操作的完整流程。

💡 **答案：**

JDK 8 的 HashMap 底层采用数组 + 链表 + 红黑树的复合结构。

put 操作的完整流程是：

1. 首先对 key 做 hash，将 hashCode 的高 16 位与低 16 位做异或运算（目的是让高位也参与取模，减少低位相同的碰撞），然后对数组长度取模找到桶下标。
2. 如果桶为空，直接创建新节点放入。
3. 如果桶不为空，需要判断桶中第一个节点：如果是 TreeNode 说明这个桶已经是红黑树，走树的插入逻辑；如果是普通 Node，遍历链表，找到了相同 key 就覆盖 value，找不到就插入到链表尾部，插入后检查链表长度是否达到树化阈值（8）且数组长度是否大于等于 64，满足条件则将链表转为红黑树。
4. 插入完成后检查 size 是否超过 threshold，超过则扩容为原来的两倍。

get 操作相对简单：计算 hash 找到桶下标，判断桶中第一个节点是否是目标（先比较 hash，再比较 key 的引用和 equals），如果是树节点走 `getTreeNode` 查找，否则遍历链表查找。

**追问1：** JDK 7 到 JDK 8，HashMap 做了哪些关键优化？为什么链表转红黑树的阈值是 8？

JDK 7 到 8 有三个关键优化：

- 第一，哈希算法简化了——JDK 7 的 hash 方法做了多次移位和异或试图让哈希更均匀，JDK 8 只做了一次高 16 位与低 16 位的异或，因为 JDK 8 引入了红黑树，即使偶尔碰撞多一点也能在 O(log n) 时间内完成查找，不再需要那么重的哈希扰动。
- 第二，链表插入方式变了——JDK 7 是头插法（新节点插入链表头部），JDK 8 改为了尾插法。头插法在扩容迁移节点时会导致链表反转，多线程环境下会产生循环链表，尾插法彻底解决了这个问题。
- 第三、引入了红黑树。链表转红黑树阈值设为 8 的原因与泊松分布有关：理想情况下 put 操作的哈希碰撞概率极低，链表长度达到 8 的概率是千万分之一级别。如果一条链表真的到了 8，说明哈希函数的随机性出了问题，通过转为红黑树来兜底，避免退化为 O(n)。红黑树节点占用的内存大约是链表节点的两倍，所以阈值不能太低；而在 8 以内链表遍历的性能已经完全够用。

**追问2：** HashMap 在多线程环境下使用会出现什么问题？ConcurrentHashMap 是如何解决这些问题的？

HashMap 多线程最典型的两个问题是死循环和数据覆盖。

- 死循环只出现在 JDK 7 中——两个线程同时扩容时，头插法导致链表反转形成环形链表，get 操作触发无限循环 CPU 100%。
- JDK 8 尾插法解决了死循环但数据覆盖问题依然存在——两个线程同时 put，size++ 不是原子操作导致计数不准确，或者两个线程同时判断桶为空并分别插入导致其中一个数据丢失。

ConcurrentHashMap 在 JDK 8 中采用 CAS + synchronized 的并发策略：数组中没有节点时用 CAS 尝试插入；已有节点时对桶中第一个节点加 synchronized 锁（锁粒度在单个桶而非整个 Map），并支持多线程并发扩容（每个线程负责一部分桶的迁移）。这种设计的并发度远高于 JDK 7 的分段锁（Segment），因为只要两个线程访问不同桶就完全无锁竞争。

📌 **易错点 / 加分项：**
- 树化需要同时满足链表长度 ≥ 8 且数组长度 ≥ 64，数组太小时优先扩容而不是树化
- ConcurrentHashMap 的 get 不需要加锁，因为 Node 的 val 和 next 都被 volatile 修饰
- HashMap 容量永远是 2 的幂，是为了能用 `(n-1) & hash` 代替取模运算，位运算效率更高

---

## 2. ArrayList vs LinkedList 深入对比

❓ **题目：** ArrayList 和 LinkedList 在底层实现、随机访问、插入删除上的性能差异是怎样的？

💡 **答案：**

ArrayList 底层是 Object 数组，元素在内存中连续存储；LinkedList 是双向链表，每个节点维护前后指针。随机访问上，ArrayList 由于底层数组的连续性，时间复杂度是 O(1)；LinkedList 必须从头或尾开始遍历直到找到目标位置，时间复杂度 O(n)。插入删除的结论其实比较微妙：如果是"在尾部追加"，ArrayList 在容量够时 O(1)，不够时需要扩容导致 O(n)；LinkedList 永远只需要调整指针 O(1)。如果是在中间位置插入/删除，ArrayList 需要将后续元素整体前移或后移 O(n)，LinkedList 定位到目标位置就需要 O(n) 遍历，定位之后调整指针是 O(1)。所以整体看，中间位置插入删除两者差不多，不是说 LinkedList 就一定快。

**追问1：** 很多人说 LinkedList 插入删除快，这个说法在什么条件下成立？什么条件下反而不如 ArrayList？

"LinkedList 插入删除快"只在一种情况下成立：你已经持有了目标位置的节点引用，这时候确实是 O(1)。但在实际开发中，我们几乎总是"在某个下标位置插入"——LinkedList 要先遍历到这个位置，遍历的代价是 O(n)，而 ArrayList 移动数组元素虽然是 O(n) 却是连续内存的批量复制（底层用 `System.arraycopy`，这是一条 native 指令，极快）。实际 benchmark 测试中，对于中小规模数据，ArrayList 在中间位置的插入性能经常反超 LinkedList——因为遍历链表的指针跳转会导致大量的 cache miss，而数组的连续内存在 CPU 缓存友好性上有巨大优势。所以"LinkedList 插入快"是一个需要加很多前提条件的说法，不能背死答案。

**追问2：** ArrayList 扩容为什么是 1.5 倍？为什么不用 2 倍？

ArrayList 扩容倍数是 1.5 倍（`oldCapacity + (oldCapacity >> 1)`）。这样做是综合考虑了内存利用和扩容频率。如果用 2 倍，每次扩容后新容量都是 2 的幂，在极端情况下可能造成大量内存碎片——因为 Jemalloc 等内存分配器处理 2 的幂大小的内存块时有特殊的 bin 分类，频繁分配和释放 2 的幂大小的数组容易产生碎片。用 1.5 倍增长的序列不是严格的 2 的幂，内存分配器的行为更优。另外 1.5 倍的扩容次数虽比 2 倍略多，但内存占用更平滑，不会出现扩容后一半空间浪费的情况。这也参考了 C++ vector 的实现——大部分标准库用的就是 1.5 倍增长。

📌 **易错点 / 加分项：**
- 能提到 CPU cache miss 和连续内存复制的比较，说明对底层有理解
- `ensureCapacity` 可以预防性扩容减少扩容次数，这在批量 add 时很有用
- ArrayList 的最大长度是 `Integer.MAX_VALUE - 8`，减 8 是因为有些 JVM 需要在数组头存一些元信息

---

## 3. 泛型擦除与实际应用

❓ **题目：** Java 泛型是如何实现的？"泛型擦除"指的是什么？它带来了哪些限制？

💡 **答案：**

Java 泛型是通过"类型擦除"实现的，这一点和 C# 在运行时保留具体泛型类型的方式完全不同。类型擦除的意思是：编译器在编译期检查泛型类型安全后，会把所有类型参数信息擦除掉，生成的字节码中不带任何泛型信息。具体来说，无边界限制的泛型类型 `<T>` 被替换为 Object，有上界的泛型 `<T extends Number>` 被替换为 Number，在需要的地方自动插入强制类型转换。这样做的目的是保持向后兼容——JDK 5 引入泛型时，旧的字节码和类库无需修改就可以继续运行。但代价也很明显：

- 第一，基本类型不能作为泛型参数；
- 第二，`instanceof` 不能检查泛型类型；
- 第三，不能 new 泛型数组；
- 第四，静态方法和静态变量不能使用类的泛型参数；
- 第五，不能创建泛型类型的异常类。

**追问1：** 既然有泛型擦除，为什么运行时通过反射还能拿到泛型信息？什么场景下可以拿到，什么场景下拿不到？

这里的关键是：泛型擦除只擦除**局部变量**和**方法参数**的泛型信息。如果类型信息是声明在**类、字段、方法签名**这些"声明层面"的，它们会保留在字节码的 Signature 属性表中。所以当我们通过反射获取 `Field.getGenericType()`、`Method.getGenericReturnType()`、`Class.getTypeParameters()` 时，拿到的泛型信息来自 Signature 属性，不是编译期变量持有的那部分。具体来说：假设 `List<String>` 作为类的成员变量，运行时可以拿到 `String` 这个类型参数。但如果是一个方法内部的局部变量 `List<String> list = new ArrayList<>()`，运行时通过反射是拿不到这个 String 的——因为局部变量的泛型信息根本不进入字节码。最有代表性的场景是 Gson/Fastjson 这种 JSON 框架，它们在反序列化 `List<User>` 时，必须通过子类化匿名类（`new TypeToken<List<User>>(){}`）来"捕捉"泛型参数到类的 Signature 中，否则运行时无法知道 List 里装的是什么类型。

📌 **易错点 / 加分项：**
- 泛型 eraser 和 reified 的区分——Java 是 eraser，C#/Kotlin 内联函数可以是 reified

---

## 4. Java 异常体系与最佳实践

❓ **题目：** 请描述 Java 异常体系的整体设计——Error、RuntimeException、Checked Exception 各自的定位和使用场景。在日常开发中，你有哪些异常处理的最佳实践？

💡 **答案：**

Java 异常体系的根是 Throwable，下分 Error 和 Exception 两大分支，Exception 又分 RuntimeException 和 Checked Exception。**Error** 表示 JVM 层面的严重问题——OOM、StackOverflow，应用代码不应该处理。**RuntimeException** 表示程序逻辑 bug——NPE、IllegalArgumentException，可通过代码逻辑避免。**Checked Exception** 表示可预见但不可控的外部问题——IOException、SQLException，编译器强制要求处理。

最佳实践：**不要吞掉异常**——空 catch 块是线上问题的最大元凶；**异常转换**——DAO 层 catch SQLException 后转为自定义异常保留 cause；**全局异常处理**——`@ControllerAdvice` + `@ExceptionHandler` 统一处理；**try-with-resources**——JDK 7+ 自动释放资源；**异常的业务语义**——抛什么异常表达"出了什么问题"，让上层决定重试、降级还是告警。

📌 **易错点 / 加分项：**
- Checked Exception 的争议——Spring 将其包装为 RuntimeException 就是认为"数据库连不上应让请求失败而非强制处理"
- `Throwable.fillInStackTrace()` 是异常对象中成本最高的操作，高性能场景可覆写优化

---

## 5. Stream API 与函数式编程

❓ **题目：** Java 8 的 Stream API 相比传统的 for 循环有什么优势？Stream 的惰性求值和短路操作是如何工作的？Parallel Stream 该什么时候用？

💡 **答案：**

Stream API 相比 for 循环的优势不在性能，而在**语义的声明式表达**。`filter().map().sorted().collect()` 一行表达数据处理意图，链式调用天然支持"流水线优化"——多个操作在一次遍历中合并完成。

惰性求值是 Stream 的核心设计。filter、map 等"中间操作"不立即执行，只构建流水线。"终端操作"（collect、findFirst 等）出现时整个流水线才触发。好处：**短路优化**——`filter(...).findFirst()` 找到第一个就停止；**融合优化**——`filter(...).map(...).limit(5)` 每个元素一条流水线走到底。

Parallel Stream 注意事项：只适合 CPU 密集型 + 数据量大（> 1000 条）。数据量小并行化拆分合并开销比串行慢。IO 阻塞操作用 Parallel Stream 非常危险——它用 ForkJoinPool.commonPool()，阻塞操作会耗尽 commonPool。有共享状态必须用 `collect` 而非 `forEach`。

📌 **易错点 / 加分项：**
- `peek` 主要用于调试，不应修改元素状态
- `Collectors.toMap()` 重复 key 不指定 merge 函数直接抛异常
- `parallelStream()` 在有序流上会自动降级

---

## 6. Java SPI 机制与实现原理

❓ **题目：** Java 的 SPI（Service Provider Interface）机制是什么？它是如何实现解耦的？JDBC 驱动加载就是 SPI 的经典案例，请说明其工作流程。

💡 **答案：**

SPI 是 Java 的"扩展发现"机制，核心是"接口定义 + 外部实现 + 自动发现"。在 classpath 下的 `META-INF/services/` 目录中创建以"接口全限定名"命名的文件，内容为实现类全限定名。JVM 通过 `ServiceLoader.load()` 扫描所有 jar 包中的这些文件，反射实例化所有实现类。

JDBC 是经典案例。Java 核心库只定义 Driver、Connection 等接口，MySQL 驱动 jar 包包含 `META-INF/services/java.sql.Driver` 文件。调用 `DriverManager.getConnection(url)` 时，DriverManager 通过 ServiceLoader 加载所有 Driver 实现，遍历调用 `driver.connect(url)`，第一个成功就返回。整个过程业务代码只依赖接口，完全不知道具体实现类名。

SPI 的局限：ServiceLoader 每次调用都重新创建实例、不支持按条件筛选实现类、不支持 AOP 增强。这些限制促使 Spring Boot 发展出自动配置机制。Dubbo 的 ExtensionLoader 是 SPI 的增强版——支持按 key 获取、AOP 包装、IOC 注入。

📌 **易错点 / 加分项：**
- SPI 打破了双亲委派模型——ServiceLoader 用线程上下文类加载器加载实现类
- JDK 9 模块化后 SPI 需要配合 `provides ... with` 和 `uses` 声明

---

## 7. 反射与动态代理

❓ **题目：** Java 反射机制的核心 API 有哪些？动态代理有哪两种实现方式，各自有什么限制？反射的性能代价来自哪里？

💡 **答案：**

反射核心 API 围绕 Class、Field、Method、Constructor。`Class.forName()` 获取 Class；`getDeclaredFields/Methods` 获取类结构；`field.set()` 和 `method.invoke()` 运行时操作对象。

动态代理两种实现。**JDK 动态代理**：基于接口——`Proxy.newProxyInstance()` 运行时生成实现所有指定接口的代理类，所有方法调用转发到 InvocationHandler。限制是目标类必须实现接口。**CGLIB 代理**：基于继承——运行时生成目标类子类，通过方法重写拦截调用。限制是目标和目标方法不能是 final。

反射性能代价：**类型检查开销**——Method.invoke 在运行时检查参数类型、装箱拆箱；**无法 JIT 深度优化**——反射调用无法被内联。JDK 通过"反射膨胀"优化——前 15 次走 JNI，之后动态生成委派类用普通 invokevirtual 指令替代。

📌 **易错点 / 加分项：**
- `Class.forName` vs `ClassLoader.loadClass`——前者执行类的静态初始化，后者不会
- `setAccessible(true)` 在 JDK 9+ 受 module 限制
- MethodHandle（JDK 7）和 VarHandle（JDK 9）是比反射更轻量的动态调用机制

---

## 8. IO 模型：BIO、NIO、AIO

❓ **题目：** Java 中有哪三种 IO 模型？BIO、NIO（多路复用）、AIO 各自的工作原理是什么？在高并发网络编程中怎么选？

💡 **答案：**

**BIO（Blocking IO）**：一个连接一个线程。线程调用 `read()` 时如果数据没准备好就阻塞。优点是代码简单；缺点是 1000 个连接需要 1000 个线程，线程栈 + 上下文切换撑不住高并发。

**NIO（Non-blocking IO + 多路复用）**：核心组件是 Selector 和 Channel。一个 Selector 线程同时管理多个 Channel。`selector.select()` 阻塞，Selector 检测哪些 Channel 有事件就绪，返回就绪集合。一个 Selector 可管理成百上千个连接，Netty 基于此构建。缺点是编程复杂度高——需处理粘包/拆包、半包读写。

**AIO（Asynchronous IO）**：数据读写完全异步。线程发起读操作后立刻返回，操作系统后台完成后通过回调通知。CPU 线程占用最低。但在 Linux 上底层依赖 epoll + 线程池模拟，性能与 NIO 相比没有显著优势，实际使用不如 NIO 广泛。

📌 **易错点 / 加分项：**
- NIO 的"非阻塞"和"多路复用"是两个概念——前者指 `configureBlocking(false)`，后者指 Selector 模式
- 多路复用在 Linux 底层是 epoll，Windows 是 IOCP，macOS 是 kqueue——Java Selector API 统一封装
- Netty 封装了 NIO 的复杂性，提供了 Pipeline、ChannelHandler、ByteBuf 等高级抽象

---

## 9. Java 8-21 关键新特性演进

❓ **题目：** 从 Java 8 到 Java 21，每个 LTS 版本带来了哪些对日常开发有重大影响的新特性？

💡 **答案：**

**Java 11（LTS）**：HttpClient 成为标准 API，支持 HTTP/2 和 WebSocket。String 新增 `isBlank()`、`lines()`、`strip()`、`repeat()`。可直接 `java Hello.java` 运行单文件。

**Java 17（LTS）**：Sealed Classes——`sealed class Shape permits Circle, Rectangle` 限制子类范围。Records 正式 GA——`record Point(int x, int y) {}` 一行自动生成构造器、getter、equals、hashCode、toString。Text Blocks——三引号写多行字符串。Pattern Matching for switch（预览）。

**Java 21（LTS）**：Virtual Threads 正式 GA——Java 并发模型最大变革。`Thread.ofVirtual().start(task)` 可启动成千上万虚拟线程处理并发 IO，创建成本极低。Pattern Matching for switch 正式 GA。Record Patterns——`if (p instanceof Point(var x, var y))` 解构 Record。

📌 **易错点 / 加分项：**
- Virtual Threads 不适合 CPU 密集型——它的优势是 IO 阻塞时让出底层 OS 线程
- Records 字段都是 final 的——需要修改字段时传统 POJO 仍然有用
- `var` 不能用于字段和参数声明——保持 API 签名的明确性

---

## 10. equals 与 hashCode 契约

❓ **题目：** equals 和 hashCode 的契约关系是什么？为什么重写 equals 必须重写 hashCode？如果只重写其中一个会发生什么问题？

💡 **答案：**

核心契约三条：**相等对象必须有相等的 hashCode**、**不等对象不要求不同 hashCode**、**hashCode 在 equals 所用字段不变时不应变化**。

为什么必须同时重写？HashSet/HashMap 内部先用 `hashCode()` 定位桶，再用 `equals()` 逐条比较。只重写 equals 不重写 hashCode——两个 equals 相等的对象有不同的 hashCode（默认基于内存地址），HashMap 把它们放入不同桶，破坏 Set 的"不可重复"语义。只重写 hashCode 不重写 equals——相同哈希码被放同一桶但 equals 仍是 Object 默认比较内存地址，业务上相等的对象被判定为不相等。

重写建议：用 IDE 自动生成或 Lombok `@EqualsAndHashCode`。手写用质数 31 加权——`result = 31 * result + (field != null ? field.hashCode() : 0)`。31 是奇质数，乘法可被 JVM 优化为 `(i << 5) - i`。

📌 **易错点 / 加分项：**
- `instanceof` vs `getClass()` 在 equals 中的选择——前者允许子类相等但可能违反对称性
- `HashSet` 的 `contains` 先 hashCode 定位桶再 equals 比对——放入后改字段再 contains 会找不到
- `Objects.equals(a, b)` 和 `Objects.hash(...)` 是便捷工具类
- `List<String>` 和 `List<Integer>` 的 Class 是同一个——`List.class`，这是擦除的直接后果
- 桥接方法（bridge method）是类型擦除的一个副作用，子类重写父类泛型方法时编译器自动生成

---

## 11. String / StringBuilder / StringBuffer

❓ **题目：** String、StringBuilder、StringBuffer 三者的区别是什么？String 为什么设计为不可变？字符串拼接底层是如何优化的？

💡 **答案：**

三者核心区别在于**可变性**和**线程安全**。String 是不可变的——每次操作（拼接、替换等）都创建新对象，原对象不变。StringBuilder 可变、线程不安全——所有操作在同一字符数组上修改，性能最高，适合单线程。StringBuffer 也可变，但所有公开方法用 synchronized 修饰——线程安全但性能比 StringBuilder 略低。

String 设计为不可变有多层考量。**字符串常量池**的基础——如果 String 可变，常量池共享就失去意义。**安全性**——String 广泛用于类名、文件路径、URL、反射参数等，不可变保证这些关键信息不会被意外篡改。**HashMap 的 key**——String 是最常用的 Map key，不可变保证 hashCode 稳定。**线程安全**——不可变对象天然线程安全。

字符串拼接优化：JDK 5 前 `a + b` 编译为 `new StringBuilder().append(a).append(b).toString()`。JDK 9 引入 `StringConcatFactory`，通过 `invokedynamic` 动态选择最优拼接策略——简单拼接直接用 `StringConcatHelper.simpleConcat`，复杂拼接用字节码动态生成。但循环中显式用 StringBuilder 仍是最稳妥的选择。

📌 **易错点 / 加分项：**
- `"a" + "b"` 编译期优化为 `"ab"`（常量折叠），但 `s1 + s2` 运行时无法优化
- JDK 9+ Compact Strings——全 ASCII 内容用 byte[] 替代 char[]，内存减半
- 循环中 `+=` 是经典性能坑——每次创建新 StringBuilder 对象

---

## 12. 接口与抽象类的区别

❓ **题目：** Java 中接口（interface）和抽象类（abstract class）的区别是什么？Java 8+ 有了 default 方法后，接口和抽象类的边界是否模糊了？如何选择？

💡 **答案：**

核心区别四个维度。**构造器**——抽象类有构造器（子类通过 super() 调用），接口没有。**多继承**——一个类可实现多个接口，但只能继承一个抽象类。**字段**——抽象类可有实例变量和静态变量，接口中只能有 `public static final` 常量。**访问修饰符**——抽象类方法可有各种访问级别，接口方法默认 public（JDK 9+ 可有 private 辅助方法）。

Java 8 引入 default 方法后，接口确实向抽象类靠近——接口也可以有方法实现。但本质区别仍在：**状态管理**——抽象类可有实例字段保存状态，接口不能（default 方法只能访问接口常量和调用其他接口方法）。**设计意图**——接口是"能做什么"的契约，抽象类是"是什么"的模板。

选型：优先接口——定义"一种能力"让不相关的类都能实现时（Comparable、Serializable）。选抽象类——当一组紧密相关类共享字段和部分实现时（HttpServlet 抽象 init/destroy/service，子类只需覆写 doGet/doPost）。若既要模板又需多实现，组合使用——抽象类定义模板 + 接口定义能力。

📌 **易错点 / 加分项：**
- 接口 default 方法不能覆写 Object 的方法（equals、hashCode、toString）——语言层面限制
- 抽象类可没有任何抽象方法——仅用于阻止实例化
- JDK 17 Sealed Classes 让抽象类子类范围可控——和接口 permits 语法一致

---

## 13. Java 值传递

❓ **题目：** Java 是值传递还是引用传递？请用具体代码例子说明。

💡 **答案：**

Java **永远是值传递**（pass by value）。关键要理解"值"在不同类型中的含义。基本类型——传递的是值的拷贝，方法内修改不影响原变量。引用类型——传递的是**引用的拷贝**，即堆地址值的拷贝。方法内通过拷贝引用可以修改对象内容（指向相同堆对象），但改变引用本身（指向新对象）不影响方法外的原引用。

经典例子：`public void swap(Integer a, Integer b) { Integer temp = a; a = b; b = temp; }` 调用 `swap(x, y)` 后 x、y 不会交换——a、b 是 x、y 引用的拷贝，交换只影响拷贝。同样 `public void change(String s) { s = "world"; }` 调用后原 str 不变——局部变量 s 指向新字符串不影响外部引用。

很多人误以为 Java 有引用传递，是因为看到"传入对象后修改对象属性，外部能看到变化"——这其实是传递的引用拷贝指向了同一对象。真正引用传递（如 C++ `&` 参数）允许方法内改变引用本身并影响外部——Java 做不到。

📌 **易错点 / 加分项：**
- C++ `void swap(int& a, int& b)` 可实现真正交换，Java 无法仅通过方法调用交换 int 变量
- String 和包装类因不可变性常被误认为"值传递"——其实也是引用拷贝，只是对象不可修改

---

## 14. try-catch-finally 与 return

❓ **题目：** 如果在 try 块中有 return 语句，finally 还会执行吗？如果 finally 中也有 return，最终返回哪个？

💡 **答案：**

finally 一定会执行——即使 try 中有 return。执行顺序：try 中 return 表达式先计算（暂存返回值到局部变量），然后执行 finally，最后返回暂存值。但如果 finally 中有 return，会**覆盖** try 的返回值——finally 的 return 成为最终结果。这是一个危险行为，因为 try 中抛的异常或返回的值会被 finally 的 return 彻底吞噬。

关键场景：**场景一**——`try { return 1; } finally { return 2; }` 最终返回 2。**场景二**——`try { return 1; } finally { System.out.println("finally"); }` 打印 "finally" 后返回 1。**场景三**——`try { throw new Exception(); } finally { return 0; }` 异常被吞噬，方法正常返回 0——这是 finally 中 return 最危险之处。**场景四**——finally 中修改对象属性，`try { return person; } finally { person.name = "changed"; }` 返回的 person 中 name 已是 "changed"——return 暂存的是引用，对象本身被 finally 修改。

JDK 7+ try-with-resources 避免了 finally 的很多坑——资源关闭自动执行。如必须在 finally 中清理，**永远不要在 finally 中写 return 或 throw**。

📌 **易错点 / 加分项：**
- `System.exit(0)` 在 try 中可让 finally 不执行——唯一例外
- finally 在 return 之后、方法返回之前执行——返回值先计算，但返回动作最后做
- 嵌套 try 的 finally 执行顺序——最内层先执行，向外逐层

---

## 15. 内部类

❓ **题目：** Java 中有哪几种内部类？匿名内部类和 Lambda 表达式的关系是什么？静态内部类和非静态内部类在内存结构和引用关系上有什么区别？

💡 **答案：**

Java 内部类分四种。**成员内部类**——定义在类中方法外，持有对外部类实例的隐式引用（`Outer.this`），必须先有外部类实例才能创建。**静态内部类**——用 `static` 修饰，不持有外部类实例引用，本质是独立类放在其他类内部，不需要外部类实例即可创建。**局部内部类**——定义在方法内部，作用域仅限于该方法，可访问 final/effectively final 局部变量。**匿名内部类**——没有名字，用于临时实现接口或抽象类，编译生成 `Outer$1.class`。

Lambda 表达式是匿名内部类的语法糖——当接口只有一个抽象方法（函数式接口）时可用 Lambda 代替。Lambda 底层用 `invokedynamic` + `MethodHandle` 实现，效率更高且不生成额外 .class 文件。

关键区别——**静态内部类 vs 非静态内部类**：非静态内部类自动持有外部类引用，如果内部类实例生命周期比外部类长，会导致外部类无法被 GC——这是**内存泄漏的常见原因**（如 Android Handler）。静态内部类没有这个引用，更安全。如果内部类不需要访问外部类的实例成员，**优先使用静态内部类**。

📌 **易错点 / 加分项：**
- 局部内部类和匿名内部类只能访问 final/effectively final 局部变量——因为局部变量生命周期和方法不同，Java 用"拷贝"解决
- Lambda 中 `this` 指向外部类实例，匿名内部类中 `this` 指向匿名内部类自身——细微但重要的区别
- HashMap 的 Node 和 TreeNode 都是静态内部类——不需要访问 HashMap 实例，所以用 static
