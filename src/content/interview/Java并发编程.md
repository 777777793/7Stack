# Java并发 面试题

---

## 1. synchronized 锁升级机制

❓ **题目：** synchronized 在 JDK 1.6 之后引入了锁升级机制，请详细说明锁的四种状态及其升级路径。

💡 **答案：**

synchronized 锁在 JDK 1.6 之后引入了偏向锁、轻量级锁、重量级锁三种实现，加上无锁状态一共四种状态，并且状态只能升级不能降级（降级仅在 GC 的 STW 阶段可能发生）。无锁状态下，如果只有一个线程反复获取同一把锁，JVM 会假设这把锁大概率一直被这个线程使用，于是将锁标记为偏向锁，在对象头的 Mark Word 里记录这个线程 ID，以后该线程再进入同步块时只需比对线程 ID，无需任何 CAS 操作。当第二个线程尝试获取偏向锁时，偏向锁会被撤销，升级为轻量级锁。轻量级锁通过 CAS 将 Mark Word 中的锁记录指针指向当前线程栈帧中的 Lock Record，竞争线程通过自旋等待锁释放。如果自旋超过一定次数仍未获取到锁，或者有第三个线程也参与竞争，轻量级锁就会膨胀为重量级锁，此时未获取到锁的线程会被挂起进入阻塞队列，由操作系统层面的 mutex 来调度，线程切换成本较高。

**追问1：** 偏向锁的撤销为什么是"重"操作？撤销的触发条件是什么？

偏向锁的撤销之所以是"重操作"，是因为它需要在全局安全点（Safe Point）执行。安全点意味着所有 Java 线程都要停下来，JVM 要暂停业务线程，检查持有偏向锁的线程是否还存活、是否还在同步块内。如果原持有线程已死亡，则撤销偏向并回退到无锁状态；如果原持有线程仍在同步块内，则升级为轻量级锁。这个过程涉及 STW 暂停，所以高竞争场景下偏向锁反而会成为负担——频繁的偏向锁撤销带来的暂停比直接使用轻量级锁消耗更大。触发撤销的条件很简单：当另一个线程尝试获取这个偏向锁时，JVM 就会进入撤销流程。

**追问2：** 轻量级锁自旋失败的线程会立即膨胀到重量级锁吗？自旋次数是如何决定的？

并不是自旋失败就立刻膨胀。JVM 有一个自适应自旋机制：如果之前自旋等待成功获取过锁，JVM 会认为这次自旋也有可能成功，从而允许更多次的自旋；如果之前自旋很少成功，则可能直接跳过自旋阶段膨胀到重量级锁。自旋次数不是固定值，由 JVM 根据历史成功率动态调整。另外，当第三个线程加入竞争时，即使自旋还在进行，轻量级锁也会直接膨胀，因为轻量级锁本质上只适合两个线程的低竞争场景，三个及以上的竞争已经超出了它的设计能力。

📌 **易错点 / 加分项：**
- 锁升级路径**不可逆**（正常流程下），说降级会扣分
- 偏向锁在竞争激烈的场景（如线程池多线程交替执行）反而是负优化，可以通过 `-XX:-UseBiasedLocking` 关闭
- 重量级锁挂起线程用的是 `park`/`unpark`，底层基于 pthread 的 mutex + condition variable

---

## 2. ThreadLocal 原理与内存泄漏

❓ **题目：** ThreadLocal 是如何实现线程隔离的？它的核心数据结构是怎样的？

💡 **答案：**

ThreadLocal 实现线程隔离的核心思路是：每个 Thread 内部维护一个 ThreadLocalMap，这个 Map 的 key 是 ThreadLocal 对象的弱引用，value 是线程私有的数据副本。当你调用 `threadLocal.set(value)` 时，实际上是从当前线程拿到它的 ThreadLocalMap，然后将这个 ThreadLocal 实例作为 key、value 作为值存入 Map。由于每个线程都有自己的 ThreadLocalMap，不同线程之间自然就实现了数据隔离。这里关键的设计点有两个：

- 一是数据存储在 Thread 里而不是 ThreadLocal 里
- 二是 key 使用弱引用——ThreadLocal 对象本身如果不再被外部引用，它可以被 GC 回收，不会因为 ThreadLocalMap 持有它的引用而无法释放

**追问1：** ThreadLocal 为什么会发生内存泄漏？Java 是如何在设计上缓解这个问题的？

内存泄漏的根源在于 key 是弱引用但 value 是强引用。当 ThreadLocal 对象本身不再被外部引用时，key 会被 GC 回收变成 null，但 ThreadLocalMap 中的 Entry 仍然持有对 value 的强引用。如果线程一直存活（比如线程池中的核心线程），这个 Entry 就永远不会被清理，value 对应的对象也无法被回收，这就形成了内存泄漏。Java 的缓解措施是：在每次调用 `get()`、`set()`、`remove()` 时，会顺带清理掉 key 为 null 的 Entry（即过期条目）。但这只是"缓解"而非"根治"——如果线程池中的线程长期不调用这些方法，泄漏依然存在。

**追问2：** 线程池场景下使用 ThreadLocal 有什么需要特别注意的？

线程池场景是 ThreadLocal 内存泄漏的重灾区。线程池中的核心线程是复用的，不会被销毁，ThreadLocalMap 中的数据会一直驻留。最关键的问题是"数据污染"：上一次请求在 ThreadLocal 中设置的数据没有被清理，下一个请求复用了同一个线程，就可能读取到上一个请求残留的数据，造成业务逻辑错误甚至安全问题。所以在线程池场景下，**必须在 finally 块中显式调用 `remove()`** 清理数据。这也是阿里 Java 开发手册中强制要求的规范。

📌 **易错点 / 加分项：**
- 能说清 ThreadLocalMap 解决 hash 冲突用的是**开放地址法**而不是链表法
- ThreadLocalMap 的 Entry 继承自 WeakReference，但只弱引用了 key，value 依然是强引用
- 如果面试官问"怎么彻底避免"，回答是在每次使用完后 `finally { threadLocal.remove(); }`

---

## 3. AQS 核心原理与 ReentrantLock

❓ **题目：** 请从 AQS（AbstractQueuedSynchronizer）的角度，解释 ReentrantLock 的加锁和释放锁过程。

💡 **答案：**

AQS 是一个基于 FIFO 同步队列的框架，核心是一个 `volatile int state` 状态变量和一个 CLH 变种的双向链表队列。ReentrantLock 基于 AQS 实现：加锁时尝试 CAS 将 state 从 0 设为 1——如果成功，设置当前线程为持有者，加锁完成；如果失败，将当前线程包装成 Node 节点加入等待队列尾部，然后进入自旋，不断尝试判断自己的前驱节点是否是头节点且能否获取到锁。如果前驱是头节点且 CAS 设置 state 成功，将当前节点设为新的头节点并返回。如果前驱不是头节点或者获取锁失败，根据前驱节点的 waitStatus 决定是否要挂起自己（通过 `LockSupport.park`），等待前驱节点释放锁时唤醒。释放锁时将 state 减为 0，唤醒头节点的下一个节点。整个过程利用 CAS 保证 state 修改的原子性，用 LockSupport 实现线程的精确唤醒与挂起。

**追问1：** AQS 的 CLH 队列为什么设计成双向链表？Node 中 `waitStatus` 字段有哪些取值，分别代表什么含义？

CLH 队列设计为双向链表是有明确目的的。入队操作在尾部，需要 CAS 操作 tail 指针，只需要知道当前 tail 是什么即可，不需要反向指针。但释放锁时需要唤醒后继节点，如果从 head 往后遍历单向链表，遇到已取消的节点（CANCELLED）需要特殊处理；而双向链表让后继节点在被唤醒时也能感知到前驱节点的状态变化，取消节点的自我移除也更方便实现。`waitStatus` 共有五个取值：

- 默认值 0 表示节点处于正常状态
- `SIGNAL`（-1）表示当前节点释放锁后需要唤醒后继节点
- `CONDITION`（-2）表示节点在条件队列中等待
- `PROPAGATE`（-3）用于共享模式，表示释放锁时需要传播唤醒
- `CANCELLED`（1）表示节点因超时或中断被取消。最常见用的是 SIGNAL——每个节点在进入等待前会把前驱节点的 waitStatus 设为 SIGNAL，就像给前驱留了一个"你释放时记得叫我"的标记。

**追问2：** ReentrantLock 的公平锁和非公平锁在实现上有什么不同？为什么非公平锁性能更好？

公平锁和非公平锁在 AQS 上的实现差异集中在一个方法——`tryAcquire`。公平锁在尝试获取锁之前会先调用 `hasQueuedPredecessors()` 检查等待队列中是否有比当前线程等得更久的线程，如果有则当前线程直接加入队列排队，不尝试抢锁。非公平锁不做这个检查，直接 CAS 抢锁，抢到就执行，抢不到才入队。非公平锁性能更好的原因是：当锁刚释放、头节点的后继线程被操作系统调度唤醒的过程中有一个短暂的"真空期"，此时如果有新的线程恰好到达，非公平锁可以让它直接拿锁而无需上下文切换。如果让唤醒中的线程拿锁，需要完整的线程调度延时（微秒到毫秒级），而新来的线程可能正好在运行态，直接就能执行，吞吐量更高。代价是非公平锁可能导致队列中的线程"饿死"，但这在生产环境中通常不是问题——长时间的饥饿需要极端密集的抢锁场景。

📌 **易错点 / 加分项：**
- ReentrantLock 的可重入就是靠 `state` 递增，同一个线程每次 lock 加 1，每次 unlock 减 1
- AQS 除了独占模式（ReentrantLock）还有共享模式——如 Semaphore、CountDownLatch，共享模式下 state 的语义不同
- 能说清楚为什么 `LockSupport.park` 可以响应中断，而 `synchronized` 的阻塞不能

---

## 4. 线程池核心参数与调优

❓ **题目：** ThreadPoolExecutor 的七个核心参数是什么？一个任务提交到线程池后的执行流程是怎样的？

💡 **答案：**

ThreadPoolExecutor 七个参数：`corePoolSize`（核心线程数）、`maximumPoolSize`（最大线程数）、`keepAliveTime`（空闲线程存活时间，作用于超出核心数的那部分线程）、`TimeUnit`（时间单位）、`BlockingQueue`（任务队列）、`ThreadFactory`（线程工厂）、`RejectedExecutionHandler`（拒绝策略）。任务提交后的执行流程有四步：

1. 当前线程数小于 corePoolSize，直接创建新线程执行任务，即使有核心线程空闲也创建。
2. 线程数已达到 corePoolSize，新任务被放入阻塞队列等待。
3. 队列满了且线程数小于 maximumPoolSize，创建新的非核心线程处理任务。
4. 队列满了且线程数也达到了 maximumPoolSize，触发拒绝策略。

四种内置拒绝策略：

- AbortPolicy（直接抛异常，默认）
- CallerRunsPolicy（由提交任务的线程自己执行）
- DiscardPolicy（静默丢弃）
- DiscardOldestPolicy（丢弃队列中最老的任务）

**追问1：** 线程池的"最大线程数"参数在什么情况下才真正发挥作用？为什么很多框架（如 Dubbo）把核心线程数和最大线程数设为一样？

最大线程数只有在阻塞队列满了之后才会被触发，换句话说如果你用的是无界队列（如不指定容量的 LinkedBlockingQueue），队列永远不会满，maximumPoolSize 就是一个摆设，线程池中永远只有 corePoolSize 个线程。很多框架把 corePoolSize 和 maxPoolSize 设成一样的原因：

- 一是配合有界队列使用时可以简化行为——线程数固定，不会动态伸缩，行为可预测
- 二是避免了频繁创建销毁线程的开销——从 core 扩到 max 时机发生在队列满之后，这时候系统已经在高压状态了，再创建新线程反而加重负担
- 三是从运维角度看，固定大小的线程池更容易做容量规划和监控

**追问2：** 如何合理地设置线程数？CPU 密集型和 IO 密集型任务的线程数计算公式有什么不同，为什么？

CPU 密集型任务的线程数一般设为 CPU 核数 + 1 ——因为 CPU 密集型任务几乎不阻塞，每个 CPU 核心可以满负荷执行一个线程，多出的一个线程作为"备用"，当某个线程因为缺页中断等原因短暂挂起时可以顶上。设再多线程没有意义，反而增加上下文切换开销。IO 密集型任务的线程数公式是 `CPU核数 × (1 + 平均等待时间/平均计算时间)` ——因为 IO 操作时线程处于阻塞状态，CPU 是空闲的，可以起更多线程让 CPU 在不同线程间切换始终保持忙碌。实际项目中这个比例很难精确测算，一个更实用的经验值是对 IO 密集型设为核心数的两倍左右，然后通过压测微调——观察 CPU 利用率、线程等待时间、任务队列积压量等指标来决策。

📌 **易错点 / 加分项：**
- 线程池的线程销毁机制：只有超过 corePoolSize 且空闲时间超过 keepAliveTime 的线程才会被回收，核心线程默认不回收（JDK 6+ 允许 `allowCoreThreadTimeOut` 回收核心线程）
- Executors 的 `newFixedThreadPool` 和 `newCachedThreadPool` 的坑——前者用无界队列可能导致 OOM，后者线程数无上限
- 线程池的 prestart 相关方法可以在线程池初始化时就把核心线程创建好，避免请求来时才创建的冷启动延迟

---

## 5. volatile 的可见性与禁止指令重排

❓ **题目：** volatile 关键字的两个核心作用是什么？它和 synchronized 在使用场景上有什么本质区别？

💡 **答案：**

volatile 有两大核心作用：保证可见性和禁止指令重排。可见性是说一个线程修改了 volatile 变量后，新值立即对其他线程可见——底层是通过 CPU 的缓存一致性协议（MESI）和内存屏障来实现的，写 volatile 变量后插入 StoreLoad 屏障，强制将本地缓存刷新到主存；读 volatile 变量前插入 LoadLoad 和 LoadStore 屏障，强制从主存重新读取。禁止指令重排是说 volatile 变量前后的指令不会被 JIT 编译器和 CPU 打乱顺序——这由内存屏障保证。volatile 和 synchronized 的本质区别在于：volatile 只能修饰变量，解决的是"一个线程写、多个线程读"场景下的可见性问题，没有互斥和原子性；synchronized 解决的是"多个线程读写"场景下的互斥和原子性问题，同时也附带可见性保证（JMM 规定 unlock 前必须将变量刷回主存）。

**追问1：** volatile 能保证原子性吗？`volatile int i = 0; i++;` 在多线程下安全吗？

volatile 不能保证原子性。`i++` 实际上是三步操作：读 i 的值、加 1、写回 i。volatile 只能保证每一步读到的 i 是最新值，以及在写回时其他线程能看到，但不能阻止两个线程同时读到同样的值（比如都读到 0，都加 1 写回 1，期望是 2，实际是 1）。要保证 `i++` 的原子性，要么用 synchronized，要么用 AtomicInteger（底层 CAS）。这也是 volatile 最经典的使用限制——它只适合"写入不依赖于当前值"的场景，比如状态标志位 `volatile boolean flag = true`。

**追问2：** DCL（双重检查锁）单例模式中，`instance` 为什么必须声明为 volatile？

DCL 单例中 `instance = new Singleton()` 不是原子操作，底层大致对应三条指令：分配内存空间（分配好了，instance 指向这块内存，但内容是零值）→ 执行构造方法初始化对象 → 将 instance 引用指向内存地址。问题在于 JIT 或 CPU 可能将后两步重排——先建立引用再初始化，这样 instance 就先不为 null 了但对象还没初始化完成。另一个线程在第一个 if (instance == null) 检查时看到 instance 非 null，直接返回了一个构造器还没跑完的"半成品"对象，调用时出现不可预知的错误。加 volatile 禁止了这个重排——volatile 变量的写操作后面的 StoreLoad 屏障确保"引用指向内存地址"这个动作之前，构造方法一定已经执行完毕。JDK 5 之前 volatile 语义不够强，需要额外用局部变量的 trick；JDK 5 加强了 volatile 语义后，加 volatile 就足够了。另外，如果不需要延迟加载，直接用饿汉式或者枚举单例更简单也更安全。

📌 **易错点 / 加分项：**
- volatile 不保证原子性是每次面试必问，`i++` 是最经典的例子
- 能说出 JMM 的 happens-before 规则中 volatile 写 happens-before 后续的 volatile 读，说明理论功底到位
- 枚举单例是最安全的单例方式——JVM 保证枚举的实例化是线程安全的，且序列化也不会破坏单例

---

## 6. CompletableFuture 异步编程

❓ **题目：** CompletableFuture 相比 Future，解决了哪些痛点？它的核心 API 家族是如何划分的？

💡 **答案：**

CompletableFuture 解决了 Future 的三个核心痛点：

- 一是"阻塞获取结果"——Future 只能通过 `get()` 阻塞等待结果，CompletableFuture 支持回调方式（`thenApply`、`thenAccept`），异步结果到达后自动触发后续操作
- 二是"链式编排"——Future 不支持一个异步任务完成后触发另一个异步任务，CompletableFuture 通过函数式编程风格的任务链实现了 `stage1.thenCompose(result -> stage2)` 这样的任务编排
- 三是"多任务组合"——Future 没有方便的 `allOf` 或 `anyOf` 语义来编排多个异步任务，CompletableFuture 内置了这些组合操作

另外 CompletableFuture 还支持异常处理（`exceptionally`、`handle`——异常可恢复，`whenComplete`——结果感知）、支持"主动完成"（`complete` 方法手动设值）以及灵活的线程池指定（`thenApplyAsync` 可以选择用哪个线程池）。

**追问1：** `thenApply`、`thenCompose`、`thenAccept` 的适用场景有什么不同？`thenCompose` 存在的必要性是什么？

三者适用于不同场景：

- `thenApply(Function<T, U>)` 是纯数据转换——输入 T 输出 U，同步执行，不返回 CompletableFuture。比如将返回的 User 对象转换为其它的 DTO。
- `thenCompose(Function<T, CompletionStage<U>>)` 是异步任务连接——输入 T 返回一个 CompletableFuture，用于"当前异步任务完成后自动触发另一个异步任务"。关键区分：`thenCompose` 是"第一个任务结果拿来去开启第二个异步任务"，`thenCompose` 存在的必要性在于——如果不用它而是用 `thenApply` 返回 `CompletableFuture<CompletableFuture<U>>`，就嵌套了两层——外面是一个 Future。
- `thenAccept(Consumer<T>)` 是纯消费——输入 T，无返回值。用于"异步操作完成后做一些事情"（如保存日志、发送通知），不适合做数据管道。

**追问2：** 多个 CompletableFuture 并行处理后汇总结果，怎么做？如果有任意一个失败就整体失败，又怎么做？

多个 CompletableFuture 并发执行后汇总——用 `CompletableFuture.allOf(f1, f2, f3)` 等待所有完成，然后通过 `f1.join()` 逐一获取结果。但 `allOf` 返回的是 `CompletableFuture<Void>`，无法直接获取结果，所以常见的模式是 `CompletableFuture.allOf(f1, f2, f3).thenApply(v -> Arrays.asList(f1.join(), f2.join(), f3.join()))`。如果任意一个失败就整体失败，不需要额外操作——`allOf` 完成的 CompletableFuture 在任一子任务抛出异常时也会异常完成，所以在 `thenApply` 中 `join()` 会抛出异常。但如果希望"所有结果都拿到"（比如有的成功有的失败但不想丢成功的），就需要在每个子任务上挂 `exceptionally` 返回 fallback 值。更复杂的场景——多个 Future 中只要有一个成功就可以前进一步——用 `anyOf`。

📌 **易错点 / 加分项：**
- CompletableFuture 的默认线程池是 `ForkJoinPool.commonPool()`，不适合 IO 密集型任务——生产环境建议传自定义线程池
- `thenCompose` 和 `flatMap`（Stream API）在概念上等价——都是"扁平化"
- `supplyAsync` 和 `runAsync` 的区别——前者有返回值（Supplier），后者无返回值（Runnable）

---

## 7. Fork/Join 框架与工作窃取

❓ **题目：** Fork/Join 框架的"工作窃取"（Work Stealing）算法是如何工作的？它适合什么类型的任务？

💡 **答案：**

Fork/Join 框架的核心思想是"大任务拆分为小任务，并行执行后归并结果"。工作窃取算法的流程是：每个工作线程都有一个双端队列存储待处理的任务。正常工作时，线程从自身队列的**尾部取任务**（LIFO，类似栈顶取），这是因为最近加入的任务缓存更热，跑起来效率更高。当一个线程把自己的队列任务都处理完了，它会"窃取"其他线程队列**头部**的任务（FIFO，窃取最旧的任务），这样被窃取的线程继续处理自己的新任务不会冲突。这种设计让线程之间的任务分布高度均衡——没有空闲线程，也没有单独的中央任务调度器。Fork/Join 最经典的使用场景是"分治"类问题：归并排序、大数组并行加工（分割求和再汇总）、树形结构的递归处理。计算密集型、可拆分为独立子问题、无共享状态的场景是它的最佳适用区。

**追问1：** Java 的并行流（Parallel Stream）底层是如何用 Fork/Join 实现的？使用并行流有哪些常见的坑？

Java 的并行流（如 `list.parallelStream().map(...).collect(...)`）底层用的是 `ForkJoinPool.commonPool()`，并行度默认是 CPU 核数（`Runtime.getRuntime().availableProcessors() - 1` 通常）。常见坑几个：

- 一是"commonPool 被阻塞"——如果在并行流中执行 IO 阻塞操作，会阻塞 ForkJoinPool 的工作线程，导致整个 commonPool 的线程都不足以处理其他并行任务，整个 JVM 的并行流都停滞。
- 二是并行流不适合小数据量——拆分和归并的开销可能大于直接串行计算，几千个元素级别时并行流反而更慢。
- 三是线程安全问题——并行流中操作的共享变量需要加锁或用原子类，并行化后线程安全问题更隐蔽。
- 四是 `parallelStream` 不能保证有序——除非用 `forEachOrdered` 但性能会下降。

**追问2：** ForkJoinPool 和普通的 ThreadPoolExecutor 在内核线程使用和任务调度上有什么本质区别？

本质区别在任务调度模型和线程的内核行为。ThreadPoolExecutor 使用一个共享的阻塞队列作为任务缓冲区——所有工作线程都从同一个队列里取任务，多个线程竞争队列锁，高并发场景下队列是瓶颈。ForkJoinPool 使用工作窃取——每个线程有自己的双端队列，只在窃取时才跨线程，单个线程处理自身任务无需锁，并发度更高。在 CPU 利用率上，ForkJoinPool 的线程在无事窃取时会"等待一段时间"然后主动释放 CPU（park），被窃取线程被窃取时也不需要有实质性的锁竞争。另一个关键区别是 ForkJoinPool 的任务是 ForkJoinTask 而不是 Runnable——它们可以被递归地 fork 拆分、join 等待子任务。

📌 **易错点 / 加分项：**
- commonPool 全局共享——不能因为一个业务的需要修改 commonPool 并行度（通过 JVM 参数修改会影响所有并行流）
- ForkJoinTask 的 `invoke`、`fork`、`join` 三者的关系——`fork` 是异步提交子任务，`join` 是等待子任务结果
- RecursiveTask 有返回值，RecursiveAction 无返回值——对应 Fork/Join 中有/无归并结果的场景

---

## 8. CAS 底层实现与 ABA 问题

❓ **题目：** CAS（Compare And Swap）的底层实现原理是什么？它有什么局限性？ABA 问题是如何产生的，又该如何解决？

💡 **答案：**

CAS 的全称是 Compare And Swap，它是一种"无锁"的并发原语，核心思想是：比较内存当前位置的值和期望值，如果匹配则将新值写入；如果不匹配说明被其他线程改过了，不做写入。整个"比较+交换"过程是原子操作，由 CPU 的 `cmpxchg` 指令在硬件层面保证。Java 通过 `sun.misc.Unsafe` 类的 native 方法来使用 CAS——`Unsafe.compareAndSwapInt(Object o, long offset, int expected, int x)` 中的 offset 是字段在对象内存布局中的偏移量，Unsafe 直接操作内存地址完成 CAS。JUC 中的 AtomicInteger、AtomicReference 等原子类底层全是 CAS。

CAS 有三个主要局限性：

- 一是**循环开销**——CAS 失败后需要自旋重试，竞争激烈时 CPU 空转消耗大。
- 二是**只能保证一个共享变量的原子操作**——要原子操作多个变量就需要把多个变量包装成一个引用对象然后用 AtomicReference 操作，或者用锁。
- 三是**ABA 问题**——线程 A 读取值 V，线程 B 把它改成 W 又改回 V，线程 A 再次 CAS 时发现值还是 V，误以为没人改过就直接更新了。虽然值看起来没变，但"中间经历过变化"这件事对某些业务有语义影响——比如链表操作中，线程 A 准备把头节点从 A 移到 C，但线程 B 期间把 A 移走又插回来，线程 A 的 CAS 成功了但链表结构已经变了。

解决 ABA 问题用版本号或时间戳。Java 提供了 `AtomicStampedReference`——它在维护引用对象的同时维护一个整数版本号（stamp），CAS 时同时比较引用值和 stamp，两个都匹配才更新。另外还有 `AtomicMarkableReference`，只用布尔标记来追踪"是否被修改过"，功能更轻量但无法处理多次 ABA。

**追问1：** CAS 底层调用的是 CPU 的什么指令？`cmpxchg` 和 `lock cmpxchg` 有什么区别？

x86 架构上 CAS 底层用的是 `cmpxchg` 指令。但单用 `cmpxchg` 只在单核 CPU 下是原子的——多核下多个核心可能同时执行 `cmpxchg` 操作同一内存地址，需要加上 `lock` 前缀变成 `lock cmpxchg`。`lock` 前缀锁住总线或缓存行（通过 MESI 协议），保证在多核环境下的原子性和可见性。HotSpot 的 Unsafe 实现中，CAS 操作最终都编译为带 `lock` 前缀的 `cmpxchg` 指令，所以在多核环境下能正确工作。这也是 CAS 比加锁更快但不免费的原因——`lock` 前缀依然有开销（锁缓存行、内存屏障），但远小于线程上下文切换的开销。

📌 **易错点 / 加分项：**
- CAS 的 ABA 问题和版本号解决方案——能用 `AtomicStampedReference` 的场景说明理解到位
- LongAdder（JDK 8）优于 AtomicLong 的场景是"高并发频繁更新"——LongAdder 用分段累加降低 CAS 竞争
- 能说出 `Unsafe` 在 JDK 9+ 被封装到 `jdk.internal.misc` 包，且在 JDK 17+ 逐步被 VarHandle 替代

---

## 9. LongAdder vs AtomicLong

❓ **题目：** 在高并发计数场景下，LongAdder 为什么比 AtomicLong 性能更好？它们的实现原理有什么根本区别？

💡 **答案：**

AtomicLong 在高并发下的性能瓶颈在于所有线程都在竞争同一个 CAS 操作——大量线程自旋重试同一个内存变量，CAS 失败率极高，CPU 空转严重。LongAdder 的核心思想是"分段累加"——将单一热点变量拆分为一个 `base` 值加上一个 `Cell` 数组，每个 Cell 是一个独立的累加单元。写入时，线程先尝试 CAS 更新 base 值（低竞争路径），如果 CAS 失败，线程根据自身的探针值（`threadLocalRandomProbe`）哈希到某个 Cell 上，然后 CAS 更新那个 Cell。不同线程散列到不同 Cell，竞争被分摊，写入吞吐量大大提升。读取时调用 `sum()`，将 base 和所有 Cell 的值累加起来——注意 `sum()` 不是原子的，可能在累加过程中又有新写入，但它保证最终一致性。

两者的应用场景有明确区分。AtomicLong 适合低并发写入场景——单次 CAS 成本低，且 `get()` 是原子读，实时精度高。LongAdder 适合高并发写入 + 对读取精度要求不高的场景——比如 QPS 计数器、请求量统计，牺牲一点读取精度换大幅写入吞吐量提升。LongAdder 的缺点是内存占用较大（Cell 数组随竞争激烈程度动态扩容，最大可达 CPU 核心数），且 `sum()` 操作有一定计算开销。JDK 8 还引入了 LongAccumulator（LongAdder 的通用化版本），可以自定义累加函数（不仅限于加法）。

**追问1：** LongAdder 的 Cell 数组是如何初始化和扩容的？什么情况下会扩容？

Cell 数组采用惰性初始化和 2 的幂扩容策略。初始时 Cell 数组为 null，所有线程直接在 base 上 CAS 累加。当 base CAS 失败（出现竞争）时，触发 Cell 数组的初始化——创建大小为 2 的数组，初始化时通过 `cellsBusy` 这个"自旋锁"（CAS 标记位）来保证只有一个线程进行初始化。之后运行时，当某个 Cell 上的 CAS 也失败（该 Cell 上竞争也激烈了），且当前数组大小小于 CPU 核心数，则触发扩容——数组大小翻倍，数据迁移到新数组。扩容同样通过 `cellsBusy` 自旋锁保护。扩容的上限是 CPU 核心数——超过这个数再扩容没有意义，因为硬件的并行度只有这么多。扩容后之前竞争激烈的 Cell 中的数据依然在原 Cell 中，新来的线程通过重新哈希散列到新 Cell 上，竞争被进一步分摊。

📌 **易错点 / 加分项：**
- LongAdder 的 `sum()` 不是强一致性的——高并发写入时返回值可能略小于实际值，这是业务需要接受的 trade-off
- `LongAdder.sum()` 内部遍历 Cell 数组时对 Cell 值的读取没有锁定——这是最终一致性的含义
- Striped64 是 LongAdder 和 LongAccumulator 的公共基类——加分点在于能说出这个设计模式（分段并发）

---

## 10. ReentrantReadWriteLock 与 StampedLock

❓ **题目：** ReentrantReadWriteLock 的读写锁机制是怎样的？StampedLock 相比它做了什么改进？各自在什么场景下更合适？

💡 **答案：**

ReentrantReadWriteLock 基于 AQS 实现，维护了一对锁：读锁（共享锁）和写锁（独占锁）。核心规则是：读锁可以被多个线程同时持有（读读不互斥），写锁独占（写读互斥、写写互斥），持有读锁的线程不能升级为写锁（升级会导致死锁），持有写锁的线程可以降级为读锁。源码层面上，AQS 的 int state 被拆分为高 16 位（读锁计数）和低 16 位（写锁计数），读锁的获取通过 CAS 递增高 16 位，写锁就是 AQS 的独占模式。但 ReentrantReadWriteLock 有一个性能问题——读锁的获取也用了 CAS，大量读线程并发获取读锁时 CAS 依然有竞争（虽然比写锁 CAS 轻），这在"读多写少"的极致场景下不够好。

StampedLock 是 JDK 8 引入的，核心改进是引入"乐观读"模式。它用 long 型的 stamp（版本戳）替代传统的读锁计数。读操作分为三种模式：悲观读（`readLock()`，与写互斥，与 ReentrantReadWriteLock 的读锁类似）、写锁（`writeLock()`，独占）、乐观读（`tryOptimisticRead()`，完全不加锁，返回一个 stamp 版本号）。乐观读之后需要用 `validate(stamp)` 校验——如果在此期间有写操作发生，stamp 会失效，`validate` 返回 false，此时再升级为悲观读重试。乐观读不涉及任何 CAS，仅仅是一次 volatile 读取 + 版本校验，在读多写极少的场景下吞吐量远超 ReentrantReadWriteLock。StampedLock 不是可重入的，也没有 Condition 支持——这是它的主要限制。

**追问1：** StampedLock 的乐观读在实际中怎么用？"先乐观读再校验失败后升级为悲观读"这个模式有什么注意点？

典型用法是一个"读-校验-必要时升级"的模板。先用 `long stamp = stampedLock.tryOptimisticRead()` 获取乐观 stamp，然后执行业务读操作（读取多个共享变量），执行完后调用 `stampedLock.validate(stamp)` 校验读取期间是否有写操作。如果 validate 通过，读取有效，直接返回；如果失败，说明期间有写操作发生，转为悲观读锁重试。关键注意点：乐观读期间读取的数据是"快照"——可能读到不一致的数据（比如两个变量一个被写前读到了、一个被写后读到了），所以 validate 失败后的处理逻辑必须能正确处理"读取的中间数据是脏的"这一情况，通常做法是直接丢弃乐观读的结果重新在悲观读锁下读取。另一个注意点是 StampedLock 不支持重入——如果同一线程在持有悲观读锁的情况下再次尝试获取写锁，会死锁。此外 StampedLock 的 stamp 为 long 类型，有溢出风险（在极高频率下），但理论上达到 `Long.MAX_VALUE` 才会溢出，实践中几乎碰不到。

📌 **易错点 / 加分项：**
- 读写锁的"锁降级"和"锁升级"——降级（写→读）安全，升级（读→写）会死锁
- StampedLock 不可重入不是 bug 是刻意设计——去掉重入让状态管理更简单、性能更高
- StampedLock 有一个 bug（JDK 8-10）：`readLock()` 的内部循环可能导致 CPU 100%，JDK 11 修复

---

## 11. CountDownLatch、CyclicBarrier、Semaphore

❓ **题目：** 请对比 CountDownLatch、CyclicBarrier 和 Semaphore 三者的设计目的、使用场景和底层实现差异。

💡 **答案：**

三者虽然都是 JUC 中的同步工具，但解决的问题完全不同。CountDownLatch 是"倒计数门闩"——一个线程（或多个线程）等待其他线程完成一组任务。主线程调用 `await()` 阻塞，每个工作线程完成任务后调用 `countDown()` 将计数器减 1，计数器归零后主线程被唤醒。它的特点是"一次性"——计数器归零后门闩永久打开，无法重置复用。典型场景：主线程等待多个子服务全部初始化完成再开始接收请求。

CyclicBarrier 是"循环栅栏"——多个线程互相等待，所有线程都到达栅栏后，栅栏打开，大家同时继续。与 CountDownLatch 的关键区别：一是"等待方向"不同——Latch 是一个线程等别人，Barrier 是大家互相等；二是"可复用"——Barrier 在所有线程通过后自动重置，可以用于下一轮等待；三是 Barrier 可以传一个 `Runnable`，在栅栏打开后、各线程释放前先执行回调。典型场景：多线程并行计算，每个线程算一块数据，全部算完后合并结果再做下一轮计算。

Semaphore 是"信号量"——控制同时访问某个资源的线程数量。初始化时设定许可证数量 `new Semaphore(5)` 表示最多 5 个线程同时访问。`acquire()` 获取许可证（没有就阻塞），`release()` 归还许可证。它和锁的根本区别在于：锁只能一个线程持有，信号量允许多个线程同时持有。典型场景：数据库连接池限制最大连接数、API 限流（限制同时调用第三方接口的并发数）。

**追问1：** CyclicBarrier 的 `await()` 方法内部发生了什么？如果有线程在 `await()` 时被中断了会怎样？

每个线程调用 `await()` 时，内部计数器减 1 然后判断是否归零。如果计数器不等于 0，线程进入 Condition 等待队列阻塞。如果等于 0（最后一个线程到达），先执行构造函数中传入的 `barrierAction`（如果有），然后唤醒所有等待线程进入下一代——计数器重置为初始值，代数量 + 1。如果有线程在 `await()` 超时或被中断，CyclicBarrier 会选择"破坏栅栏"——将 `broken` 标记设为 true，唤醒所有等待中的线程并抛出 `BrokenBarrierException`。这个设计是为了防止"某个线程掉队后其他线程无限等待"。被破坏的 Barrier 需要调用 `reset()` 方法手动重置才能继续使用。

📌 **易错点 / 加分项：**
- CountDownLatch 内部基于 AQS 共享模式——计数器为 count，`countDown()` 就是 releaseShared，`await()` 就是 acquireShared
- CyclicBarrier 内部基于 ReentrantLock + Condition 实现，不是 AQS
- Semaphore 支持公平和非公平两种模式——公平模式按 FIFO 顺序获取许可证

---

## 12. JMM 与 happens-before 规则

❓ **题目：** Java 内存模型（JMM）中的 happens-before 规则是什么？请列举关键的 happens-before 规则并说明它们如何指导我们写出正确的并发代码。

💡 **答案：**

JMM 是 Java 规范中定义的一套"内存可见性"规则，它规定了在多线程环境下，一个线程对共享变量的写入何时对另一个线程可见。JMM 的核心抽象是：每个线程有一个"工作内存"，所有线程共享一个"主内存"。但 JMM 的核心不是这个抽象模型本身，而是 happens-before 规则——它定义了两个操作之间的偏序关系。如果操作 A happens-before 操作 B，那么 A 的结果对 B 可见，且 A 的执行顺序在 B 之前。

关键的 happens-before 规则有七条：

- 一是**程序顺序规则**——同一个线程内的操作，前面的 happens-before 后面的。
- 二是**volatile 变量规则**——一个 volatile 变量的写 happens-before 后续对这个变量的读。
- 三是**锁规则**——一个锁的 unlock happens-before 后续对这个锁的 lock。
- 四是**线程启动规则**——`thread.start()` happens-before 被启动线程中的所有操作。
- 五是**线程终止规则**——一个线程中的所有操作 happens-before 其他线程对该线程的 `join()` 返回。
- 六是**传递性**——如果 A happens-before B 且 B happens-before C，则 A happens-before C。
- 七是**中断规则**——对线程的 `interrupt()` 调用 happens-before 被中断线程检测到中断事件。

这些规则直接指导并发代码。比如线程启动规则：主线程在 `start()` 之前设置的共享变量，新线程启动后一定能看到——不需要额外的 volatile 或 synchronized。线程终止规则：子线程中的计算结果在 `join()` 返回后一定对主线程可见——这也解释了为什么不需要额外加 volatile。volatile 规则和锁规则联合起来保证了"加锁-修改-unlock"和之后"lock-读"之间的可见性。

**追问1：** happens-before 和"重排序"是什么关系？JMM 如何限制重排序？

happens-before 规则本质上就是对"编译器和 CPU 可以做什么重排序"的约束。如果两条操作之间有 happens-before 关系，编译器和 CPU 不能把它们重排序为"后一条先执行"。具体来说，JMM 通过插入"内存屏障"指令来阻止特定重排序：volatile 写之前插入 StoreStore 屏障（禁止前面的普通写重排到 volatile 写之后），volatile 写之后插入 StoreLoad 屏障（禁止后面的 volatile 读/写重排到 volatile 写之前）；volatile 读之后插入 LoadLoad 和 LoadStore 屏障。synchronized 的进入和退出也隐含了内存屏障。happens-before 规则的另一个角度是"数据依赖性"——如果操作 B 依赖操作 A 的结果（比如 A 给 x 赋值，B 用 x 做计算），数据依赖本身就禁止重排序。但要注意"控制依赖"不禁止重排序。

📌 **易错点 / 加分项：**
- happens-before 不是"时间上的先后"，而是"内存可见性的保证"——即使时间上 A 先于 B，如果没有 happens-before 关系，B 也可能看不到 A 的结果
- `final` 域的写 happens-before 构造函数退出，保证了安全发布
- JMM 对 `final` 的保证有一个特殊要求：构造函数中不要把 `this` 引用逸出

---

## 13. ConcurrentHashMap 并发优化演进

❓ **题目：** ConcurrentHashMap 从 JDK 7 到 JDK 8 发生了哪些核心变化？JDK 8 的设计是如何实现高并发和高性能的？

💡 **答案：**

JDK 7 的 ConcurrentHashMap 基于"分段锁（Segment）"实现。内部维护一个 Segment 数组（默认 16 个），每个 Segment 是独立的 ReentrantLock，保护其下的一小段 HashEntry 数组。16 个 Segment 意味着默认并发度是 16——最多 16 个线程可以同时写入不同的 Segment。缺点是 Segment 的数量一旦初始化就不可改变——如果初始化时并发度设小了，后面数据量大了没法调整；还有 `size()` 操作需要跨所有 Segment 加锁。

JDK 8 做了彻底的重构，放弃了分段锁，改用 CAS + synchronized 的细粒度策略。数据结构上和 HashMap 对齐——数组 + 链表 + 红黑树。并发控制的核心是"锁住桶中的第一个节点"：如果目标桶为空，用 CAS 尝试插入新节点；如果桶不为空，对桶中第一个节点（链表头或树根）加 synchronized 锁，然后在锁内进行链表遍历/树操作。不同桶之间完全无锁竞争——并发度不再受 Segment 数量的限制，只要两个线程操作不同桶就互不干扰。get 操作全程不加锁——因为 Node 的 `val` 和 `next` 字段都是 volatile 修饰的，读操作保证可见性。

JDK 8 的 ConcurrentHashMap 还支持多线程并发扩容（扩容时每个线程负责迁移一部分桶），而且扩容期间有 ForwardingNode 机制——某个桶迁移完成后放置一个 ForwardingNode 标记，读/写请求看到这个节点会感知扩容正在进行，帮助推进扩容或等待扩容完成。`size()` 也不是全局加锁，而是通过 `sumCount()` 方法将 baseCount 和各 CounterCell 的计数累加，内部实现类似 LongAdder 的分段思想。

**追问1：** ConcurrentHashMap 的 `put` 操作为什么在"桶为空"时用 CAS 而不用 synchronized？

当桶为空时不需要持有锁——因为没有现有节点需要遍历或修改。用 CAS 插入新节点如果失败说明发生了并发冲突（另一个线程抢先插入了），此时只要 CAS 重试就行，比直接申请锁更轻量。这种"CAS 先尝试，失败再升级为锁"的策略是一种"无锁优先"的设计思想——在没有竞争的情况下直接用 CAS 完成操作，性能最优；竞争激烈时再退化为用锁保护。这和 synchronized 的偏向锁→轻量级锁→重量级锁的升级路径思路一致。

📌 **易错点 / 加分项：**
- ConcurrentHashMap 的 key 和 value 都不能为 null——因为 get 不加锁，null 无法区分"key 不存在"和"key 存在但 value 为 null"
- 扩容触发阈值是 0.75（sizeCtl），但实际上会提前触发（helpTransfer）以防频繁扩容
- `computeIfAbsent` 在 ConcurrentHashMap 中是原子的——这是很多"懒加载缓存"的标准写法

---

## 14. BlockingQueue 与生产者-消费者模式

❓ **题目：** JUC 中 BlockingQueue 有哪些实现？它们在生产者-消费者模式中的行为有什么不同？各自适合什么场景？

💡 **答案：**

BlockingQueue 是线程安全的阻塞队列，核心提供了 `put`（队列满时阻塞）和 `take`（队列空时阻塞）两个方法，天然适合实现生产者-消费者模式。常用的实现有五种：

- `ArrayBlockingQueue`——基于数组的有界阻塞队列，内部用一个 ReentrantLock + 两个 Condition（`notEmpty` 和 `notFull`）实现阻塞。容量构造时指定且不可变，公平模式可选（FIFO 等待）。
- `LinkedBlockingQueue`——基于单向链表的有界/无界阻塞队列，内部用两个独立的 ReentrantLock（putLock 和 takeLock）分别控制入队和出队，生产和消费可以并行，吞吐量高于 ArrayBlockingQueue。不指定容量时默认 `Integer.MAX_VALUE`，相当于无界。
- `SynchronousQueue`——不存储元素的队列，每个 put 必须等待一个 take，本质上是"线程之间的直接传递"。内部没有容量，put 线程直接阻塞等待 take 线程来取。
- `PriorityBlockingQueue`——无界（实际有界但扩容无限）的优先级队列，元素按自然顺序或 Comparator 排序，不阻塞 put（因为无界），take 在队列空时阻塞。
- `DelayQueue`——元素必须实现 Delayed 接口，只有当元素的延迟时间到期后才能从队列中取出。底层用 PriorityQueue 实现，无界。

场景选型上：

- ArrayBlockingQueue 适合"固定容量、流量可控"的缓冲队列
- LinkedBlockingQueue 适合"生产消费速率不匹配，需要较大缓冲"的场景
- SynchronousQueue 适合"生产消费速率基本匹配，或需要准确同步"的场景（比如线程池的 `newCachedThreadPool` 就用 SynchronousQueue）
- PriorityBlockingQueue 适合"任务有优先级"的场景（如 VIP 用户优先处理）
- DelayQueue 适合定时任务调度、订单超时取消等延迟场景

**追问1：** ArrayBlockingQueue 和 LinkedBlockingQueue 都用 ReentrantLock，为什么后者吞吐量更高？

关键在于锁的分离。ArrayBlockingQueue 的 put 和 take 共用一个 ReentrantLock——入队和出队互斥，一个线程在 put 时另一个线程不能 take，虽然对数组的操作更简单但并发度低。LinkedBlockingQueue 的 putLock 和 takeLock 是两个独立的锁——put 操作只锁 putLock，take 操作只锁 takeLock，put 和 take 可以同时进行互不阻塞。因为链表结构天然支持"头尾独立操作"——take 只操作 head，put 只操作 tail，不冲突。这是经典的"锁分离"设计模式。代价是 LinkedBlockingQueue 需要维护两个锁和两个 Condition，节点也是动态分配，GC 压力略大于 ArrayBlockingQueue。

📌 **易错点 / 加分项：**
- `LinkedBlockingQueue` 不指定容量是"无界的"，这不是 bug 但可能导致 OOM——生产环境必须指定容量
- `SynchronousQueue` 的 `add()` 方法如果没有等待的消费者会直接抛异常，必须用 `put()`
- TransferQueue（LinkedTransferQueue）是 SynchronousQueue + LinkedBlockingQueue 的混合——可以阻塞传递也可以缓冲

---

## 15. Thread 状态与 wait/notify 机制

❓ **题目：** Java 线程的六种状态是什么？`wait()` 和 `sleep()` 在状态转换和行为上有什么根本区别？

💡 **答案：**

Java 线程在 JVM 层面有六种状态，定义在 `Thread.State` 枚举中：

- NEW——创建了但还没调用 `start()`。
- RUNNABLE——正在运行或等待操作系统调度（包括了操作系统的 running 和 ready 两种状态）。
- BLOCKED——等待获取 synchronized 锁进入同步块或方法。
- WAITING——无限等待另一个线程的特定操作，如 `Object.wait()`（无超时）、`Thread.join()`（无超时）、`LockSupport.park()`。
- TIMED_WAITING——有超时的等待，如 `Thread.sleep(ms)`、`Object.wait(timeout)`、`Thread.join(ms)`、`LockSupport.parkNanos()`。
- TERMINATED——线程执行完毕或异常退出。

`wait()` 和 `sleep()` 的区别是面试高频考点：

- 第一是**归属类**——`wait()` 是 Object 的方法，`sleep()` 是 Thread 的静态方法。
- 第二是**锁的释放**——`wait()` 必须在 synchronized 块中调用，并且调用后会释放锁；`sleep()` 不要求持有锁，即使当前线程在 synchronized 块中，`sleep()` 也不会释放锁。
- 第三是**唤醒方式**——`wait()` 靠 `notify()`/`notifyAll()` 或超时唤醒，唤醒后需要重新获取锁才能继续执行；`sleep()` 到期自动唤醒。
- 第四是**中断行为**——两者被 `interrupt()` 后都会抛出 `InterruptedException`。

另一个深层区别是 wait 和 notify 底层依赖操作系统提供的条件变量机制——每一个 Java 对象都有一个 monitor（ObjectMonitor），monitor 内部维护了 WaitSet 和 EntryList 两个队列，分别对应"waiting 的线程"和"等待锁的线程"。

**追问1：** `notify()` 和 `notifyAll()` 选哪个？为什么很多规范推荐用 `notifyAll()`？

`notify()` 随机唤醒一个等待线程，`notifyAll()` 唤醒所有等待线程。推荐 `notifyAll()` 的主要原因是避免"信号丢失"——如果多个线程同时等待不同的条件但共用同一个条件变量（同一个锁对象），`notify()` 可能唤醒了一个线程但它的条件并不满足，而那个条件满足的线程却没被唤醒。经典的例子：生产者-消费者中如果生产者线程和消费者线程共用同一个锁且都用 `wait()`，`notify()` 可能唤醒一个生产者但缓冲区已满（生产者条件不满足），而真正该被唤醒的消费者线程却没被选到，导致所有线程都阻塞——这就死锁了。`notifyAll()` 唤醒所有等待线程，每个线程醒来后重新检查条件，满足条件的继续、不满足的再 wait，虽然会引发"惊群"，但在条件不复杂时安全得多。如果确认所有等待线程的条件完全一致（只有一个条件变量）、且唤醒任意一个都能正确工作，那 `notify()` 更高效。

📌 **易错点 / 加分项：**
- wait 要在循环中调用——`while (condition) { obj.wait(); }`——因为虚假唤醒（spurious wakeup）会导致 wait 在没有 notify 的情况下返回
- `Thread.sleep(0)` 不释放锁但让出 CPU 时间片——触发一次调度
- `Object.wait()` 是 native 方法，底层是 POSIX 的 `pthread_cond_wait`

---

## 16. LockSupport 核心原理

❓ **题目：** `LockSupport.park()` 和 `LockSupport.unpark()` 的底层原理是什么？它们和 `wait/notify` 相比有什么优势？

💡 **答案：**

LockSupport 是 JUC 的底层基础设施，AQS、线程池、各种锁的等待/唤醒都建立在它之上。`park()` 使当前线程阻塞（WAITING 或 TIMED_WAITING），`unpark(thread)` 唤醒指定线程。底层基于操作系统的线程挂起原语——Linux 上用 `pthread_cond_wait`/`pthread_cond_signal` 结合 mutex 实现。

LockSupport 相比 wait/notify 有三大优势：

- 第一是**调用顺序不敏感**——如果先调用 `unpark(thread)` 再调用 `park()`，`park()` 会直接返回（消耗掉那个"预发放的许可"）。这是因为 LockSupport 内部维护了一个"二值许可证"——`unpark` 给线程设置一个"许可"为可用，`park` 消耗这个许可。这与 wait/notify 的根本区别在于——wait 必须在 notify 之前调用，先 notify 后 wait 的话 notify 就没用了。这个特性让 AQS 的唤醒 + 挂起逻辑不需要考虑时序问题——`unpark` 可以提前发出，`park` 收到时如果已有许可就直接返回不阻塞。
- 第二是**精准定向**——`unpark(Thread t)` 可以指定唤醒哪个线程，而 `notify()` 是随机唤醒一个等待在某个对象上的线程。这在 AQS 中很重要——释放锁时需要精确唤醒头节点的后继节点，不能随机。
- 第三是**不需要先持锁**——wait 必须在 synchronized 块中调用，park/unpark 不需要任何锁，可以直接在任何地方调用。这在实现"先检测条件不行就 park"的模式时非常方便。

**追问1：** `park` 被 `unpark` 唤醒和被 `interrupt` 中断后，行为有什么不同？

两者都会让 `park()` 返回，但行为不同。`unpark` 的唤醒是"正常返回"——`park()` 默默返回，不抛异常，线程继续执行。`interrupt` 的中断会让 `park()` 返回但线程的中断标志被设为 true——你的代码需要通过 `Thread.interrupted()` 检查中断标志来决定是继续等待还是退出。AQS 中对这个区分处理得很精细：如果 `park` 因为 unpark 正常返回，线程继续抢锁；如果因为中断返回，AQS 会根据不同的等待模式决定行为——`parkAndCheckInterrupt` 返回中断状态让上层决定是否要传播中断。另外注意 `park` 被中断返回后不会抛 InterruptedException（这是和 wait/sleep 的又一区别）——中断状态需要主动检测。

📌 **易错点 / 加分项：**
- `park()` 的"许可"是不可累积的——连续调用两次 `unpark(thread)` 后再 `park()`，只会消耗一个许可，第二个 `park()` 仍会阻塞
- LockSupport 的 `park(Object blocker)` 方法可以传一个"阻塞原因对象"——在 jstack 的 dump 中能看到这个对象，方便排查
- `park()` 函数可能"虚假返回"（无理由返回），所以 AQS 的等待始终在 `for(;;)` 循环里检查条件

---

## 17. 伪共享（False Sharing）与缓存行

❓ **题目：** 什么是伪共享（False Sharing）？它为什么会严重影响并发性能？Java 中有哪些避免伪共享的手段？

💡 **答案：**

伪共享是指：多个线程同时修改不同的变量，但这些变量恰好位于同一个 CPU 缓存行（Cache Line，通常 64 字节），导致它们互相使对方的缓存行失效，产生大量缓存一致性协议的通信开销。底层原因是 CPU 不是以"变量"为单位管理缓存的，而是以"缓存行"（64 字节块）。当一个 CPU 核心修改了缓存行中的任意一个字节，根据 MESI 协议，其他核心中该缓存行的副本都会被标记为 Invalid，下次其他核心读取这个缓存行中它们自己的变量时，必须重新从主存或其修改核心的缓存中加载整个缓存行。如果两个线程反复修改相邻的两个变量，即使它们的逻辑完全独立，也会不断让对方的缓存行失效——这就是"伪"共享——看起来没有共享数据，但在硬件层面因为挤在同一个缓存行里而产生了共享竞争。

在 Java 中，伪共享最典型的受害者是"高并发场景下的数组操作"。比如多个线程各负责一个数组元素的写入——如果两个线程操作 `array[0]` 和 `array[1]`，这两个元素大概率在同一个缓存行，性能会比预期低很多。解决方案有几种：

- 一是**缓存行填充（Padding）**——在变量前后填充无用的 long 字段，使目标变量独占整个缓存行。JDK 8 之前 Disruptor 框架的做法是用 7 个 long（56 字节）来填充——`long p1, p2, p3, p4, p5, p6, p7; volatile long value; long p8...`。
- JDK 8 引入了 `@Contended` 注解（`sun.misc.Contended`）——加在类或字段上，JVM 会自动为该字段添加 padding，比手动填充更可靠且代码更整洁。需要通过 JVM 参数 `-XX:-RestrictContended` 解锁（默认只允许 JDK 内部类使用）。JDK 内部大量使用了 `@Contended`——比如 Thread 中的 `threadLocalRandomProbe`、LongAdder 的 Cell 数组元素、ForkJoinPool 的内部队列。

**追问1：** 你怎么判断性能瓶颈是由伪共享引起的？用什么工具或方法验证？

伪共享的特征是"CPU 利用率不高但吞吐量上不去"、"增加线程数吞吐量反而下降"、"两个逻辑无关的变量分开放到不同对象后吞吐量明显提升"。验证方法上，Linux 可以用 `perf c2c`（Cache-to-Cache）命令——它能分析缓存行在不同 CPU 核心间的传输量和命中率，直接告诉你哪些地址存在频繁的 cache line bounce。Java 层面没有直接的伪共享检测工具，但可以"实验验证"：把怀疑有伪共享的变量放在不同的对象实例中（自然就分在不同缓存行了），如果性能差距明显，基本就是伪共享。或者加 `@Contended` 前后做对比压测。JDK 14+ 的 JMH（Java Microbenchmark Harness）配合 perf 分析工具是业界用最多的组合。

📌 **易错点 / 加分项：**
- 伪共享在中等并发时可能不明显，高并发时（几十个线程）吞吐量损失可达 30-50%
- Disruptor 的 RingBuffer 大量使用缓存行填充——这是它高性能的核心秘诀之一
- JDK 8 的 `@Contended` 默认只对 JDK 内部类生效，应用代码需要 `-XX:-RestrictContended` 解锁
