# Java并发 面试题

---

## 1. synchronized 锁升级机制

❓ **题目：** synchronized 在 JDK 1.6 之后引入了锁升级机制，请详细说明锁的四种状态及其升级路径。

> 追问1：偏向锁的撤销为什么是"重"操作？撤销的触发条件是什么？
> 追问2：轻量级锁自旋失败的线程会立即膨胀到重量级锁吗？自旋次数是如何决定的？

💡 **答案：**

**主问题：** synchronized 锁在 JDK 1.6 之后引入了偏向锁、轻量级锁、重量级锁三种实现，加上无锁状态一共四种状态，并且状态只能升级不能降级（降级仅在 GC 的 STW 阶段可能发生）。无锁状态下，如果只有一个线程反复获取同一把锁，JVM 会假设这把锁大概率一直被这个线程使用，于是将锁标记为偏向锁，在对象头的 Mark Word 里记录这个线程 ID，以后该线程再进入同步块时只需比对线程 ID，无需任何 CAS 操作。当第二个线程尝试获取偏向锁时，偏向锁会被撤销，升级为轻量级锁。轻量级锁通过 CAS 将 Mark Word 中的锁记录指针指向当前线程栈帧中的 Lock Record，竞争线程通过自旋等待锁释放。如果自旋超过一定次数仍未获取到锁，或者有第三个线程也参与竞争，轻量级锁就会膨胀为重量级锁，此时未获取到锁的线程会被挂起进入阻塞队列，由操作系统层面的 mutex 来调度，线程切换成本较高。

**追问1：** 偏向锁的撤销之所以是"重操作"，是因为它需要在全局安全点（Safe Point）执行。安全点意味着所有 Java 线程都要停下来，JVM 要暂停业务线程，检查持有偏向锁的线程是否还存活、是否还在同步块内。如果原持有线程已死亡，则撤销偏向并回退到无锁状态；如果原持有线程仍在同步块内，则升级为轻量级锁。这个过程涉及 STW 暂停，所以高竞争场景下偏向锁反而会成为负担——频繁的偏向锁撤销带来的暂停比直接使用轻量级锁消耗更大。触发撤销的条件很简单：当另一个线程尝试获取这个偏向锁时，JVM 就会进入撤销流程。

**追问2：** 并不是自旋失败就立刻膨胀。JVM 有一个自适应自旋机制：如果之前自旋等待成功获取过锁，JVM 会认为这次自旋也有可能成功，从而允许更多次的自旋；如果之前自旋很少成功，则可能直接跳过自旋阶段膨胀到重量级锁。自旋次数不是固定值，由 JVM 根据历史成功率动态调整。另外，当第三个线程加入竞争时，即使自旋还在进行，轻量级锁也会直接膨胀，因为轻量级锁本质上只适合两个线程的低竞争场景，三个及以上的竞争已经超出了它的设计能力。

📌 **易错点 / 加分项：**
- 锁升级路径**不可逆**（正常流程下），说降级会扣分
- 偏向锁在竞争激烈的场景（如线程池多线程交替执行）反而是负优化，可以通过 `-XX:-UseBiasedLocking` 关闭
- 重量级锁挂起线程用的是 `park`/`unpark`，底层基于 pthread 的 mutex + condition variable

---

## 2. ThreadLocal 原理与内存泄漏

❓ **题目：** ThreadLocal 是如何实现线程隔离的？它的核心数据结构是怎样的？

> 追问1：ThreadLocal 为什么会发生内存泄漏？Java 是如何在设计上缓解这个问题的？
> 追问2：线程池场景下使用 ThreadLocal 有什么需要特别注意的？

💡 **答案：**

**主问题：** ThreadLocal 实现线程隔离的核心思路是：每个 Thread 内部维护一个 ThreadLocalMap，这个 Map 的 key 是 ThreadLocal 对象的弱引用，value 是线程私有的数据副本。当你调用 `threadLocal.set(value)` 时，实际上是从当前线程拿到它的 ThreadLocalMap，然后将这个 ThreadLocal 实例作为 key、value 作为值存入 Map。由于每个线程都有自己的 ThreadLocalMap，不同线程之间自然就实现了数据隔离。这里关键的设计点有两个：一是数据存储在 Thread 里而不是 ThreadLocal 里，二是 key 使用弱引用——ThreadLocal 对象本身如果不再被外部引用，它可以被 GC 回收，不会因为 ThreadLocalMap 持有它的引用而无法释放。

**追问1：** 内存泄漏的根源在于 key 是弱引用但 value 是强引用。当 ThreadLocal 对象本身不再被外部引用时，key 会被 GC 回收变成 null，但 ThreadLocalMap 中的 Entry 仍然持有对 value 的强引用。如果线程一直存活（比如线程池中的核心线程），这个 Entry 就永远不会被清理，value 对应的对象也无法被回收，这就形成了内存泄漏。Java 的缓解措施是：在每次调用 `get()`、`set()`、`remove()` 时，会顺带清理掉 key 为 null 的 Entry（即过期条目）。但这只是"缓解"而非"根治"——如果线程池中的线程长期不调用这些方法，泄漏依然存在。

**追问2：** 线程池场景是 ThreadLocal 内存泄漏的重灾区。线程池中的核心线程是复用的，不会被销毁，ThreadLocalMap 中的数据会一直驻留。最关键的问题是"数据污染"：上一次请求在 ThreadLocal 中设置的数据没有被清理，下一个请求复用了同一个线程，就可能读取到上一个请求残留的数据，造成业务逻辑错误甚至安全问题。所以在线程池场景下，**必须在 finally 块中显式调用 `remove()`** 清理数据。这也是阿里 Java 开发手册中强制要求的规范。

📌 **易错点 / 加分项：**
- 能说清 ThreadLocalMap 解决 hash 冲突用的是**开放地址法**而不是链表法
- ThreadLocalMap 的 Entry 继承自 WeakReference，但只弱引用了 key，value 依然是强引用
- 如果面试官问"怎么彻底避免"，回答是在每次使用完后 `finally { threadLocal.remove(); }`

---

## 3. AQS 核心原理与 ReentrantLock

❓ **题目：** 请从 AQS（AbstractQueuedSynchronizer）的角度，解释 ReentrantLock 的加锁和释放锁过程。

> 追问1：AQS 的 CLH 队列为什么设计成双向链表？Node 中 `waitStatus` 字段有哪些取值，分别代表什么含义？
> 追问2：ReentrantLock 的公平锁和非公平锁在实现上有什么不同？为什么非公平锁性能更好？

💡 **答案：**

**主问题：** AQS 是一个基于 FIFO 同步队列的框架，核心是一个 `volatile int state` 状态变量和一个 CLH 变种的双向链表队列。ReentrantLock 基于 AQS 实现：加锁时尝试 CAS 将 state 从 0 设为 1——如果成功，设置当前线程为持有者，加锁完成；如果失败，将当前线程包装成 Node 节点加入等待队列尾部，然后进入自旋，不断尝试判断自己的前驱节点是否是头节点且能否获取到锁。如果前驱是头节点且 CAS 设置 state 成功，将当前节点设为新的头节点并返回。如果前驱不是头节点或者获取锁失败，根据前驱节点的 waitStatus 决定是否要挂起自己（通过 `LockSupport.park`），等待前驱节点释放锁时唤醒。释放锁时将 state 减为 0，唤醒头节点的下一个节点。整个过程利用 CAS 保证 state 修改的原子性，用 LockSupport 实现线程的精确唤醒与挂起。

**追问1：** CLH 队列设计为双向链表是有明确目的的。入队操作在尾部，需要 CAS 操作 tail 指针，只需要知道当前 tail 是什么即可，不需要反向指针。但释放锁时需要唤醒后继节点，如果从 head 往后遍历单向链表，遇到已取消的节点（CANCELLED）需要特殊处理；而双向链表让后继节点在被唤醒时也能感知到前驱节点的状态变化，取消节点的自我移除也更方便实现。`waitStatus` 共有五个取值：默认值 0 表示节点处于正常状态；`SIGNAL`（-1）表示当前节点释放锁后需要唤醒后继节点；`CONDITION`（-2）表示节点在条件队列中等待；`PROPAGATE`（-3）用于共享模式，表示释放锁时需要传播唤醒；`CANCELLED`（1）表示节点因超时或中断被取消。最常见用的是 SIGNAL——每个节点在进入等待前会把前驱节点的 waitStatus 设为 SIGNAL，就像给前驱留了一个"你释放时记得叫我"的标记。

**追问2：** 公平锁和非公平锁在 AQS 上的实现差异集中在一个方法——`tryAcquire`。公平锁在尝试获取锁之前会先调用 `hasQueuedPredecessors()` 检查等待队列中是否有比当前线程等得更久的线程，如果有则当前线程直接加入队列排队，不尝试抢锁。非公平锁不做这个检查，直接 CAS 抢锁，抢到就执行，抢不到才入队。非公平锁性能更好的原因是：当锁刚释放、头节点的后继线程被操作系统调度唤醒的过程中有一个短暂的"真空期"，此时如果有新的线程恰好到达，非公平锁可以让它直接拿锁而无需上下文切换。如果让唤醒中的线程拿锁，需要完整的线程调度延时（微秒到毫秒级），而新来的线程可能正好在运行态，直接就能执行，吞吐量更高。代价是非公平锁可能导致队列中的线程"饿死"，但这在生产环境中通常不是问题——长时间的饥饿需要极端密集的抢锁场景。

📌 **易错点 / 加分项：**
- ReentrantLock 的可重入就是靠 `state` 递增，同一个线程每次 lock 加 1，每次 unlock 减 1
- AQS 除了独占模式（ReentrantLock）还有共享模式——如 Semaphore、CountDownLatch，共享模式下 state 的语义不同
- 能说清楚为什么 `LockSupport.park` 可以响应中断，而 `synchronized` 的阻塞不能

---

## 4. 线程池核心参数与调优

❓ **题目：** ThreadPoolExecutor 的七个核心参数是什么？一个任务提交到线程池后的执行流程是怎样的？

> 追问1：线程池的"最大线程数"参数在什么情况下才真正发挥作用？为什么很多框架（如 Dubbo）把核心线程数和最大线程数设为一样？
> 追问2：如何合理地设置线程数？CPU 密集型和 IO 密集型任务的线程数计算公式有什么不同，为什么？

💡 **答案：**

**主问题：** ThreadPoolExecutor 七个参数：`corePoolSize`（核心线程数）、`maximumPoolSize`（最大线程数）、`keepAliveTime`（空闲线程存活时间，作用于超出核心数的那部分线程）、`TimeUnit`（时间单位）、`BlockingQueue`（任务队列）、`ThreadFactory`（线程工厂）、`RejectedExecutionHandler`（拒绝策略）。任务提交后的执行流程有四步：第一步，当前线程数小于 corePoolSize，直接创建新线程执行任务，即使有核心线程空闲也创建。第二步，线程数已达到 corePoolSize，新任务被放入阻塞队列等待。第三步，队列满了且线程数小于 maximumPoolSize，创建新的非核心线程处理任务。第四步，队列满了且线程数也达到了 maximumPoolSize，触发拒绝策略。四种内置拒绝策略：AbortPolicy（直接抛异常，默认）、CallerRunsPolicy（由提交任务的线程自己执行）、DiscardPolicy（静默丢弃）、DiscardOldestPolicy（丢弃队列中最老的任务）。

**追问1：** 最大线程数只有在阻塞队列满了之后才会被触发，换句话说如果你用的是无界队列（如不指定容量的 LinkedBlockingQueue），队列永远不会满，maximumPoolSize 就是一个摆设，线程池中永远只有 corePoolSize 个线程。很多框架把 corePoolSize 和 maxPoolSize 设成一样的原因：一是配合有界队列使用时可以简化行为——线程数固定，不会动态伸缩，行为可预测；二是避免了频繁创建销毁线程的开销——从 core 扩到 max 时机发生在队列满之后，这时候系统已经在高压状态了，再创建新线程反而加重负担；三是从运维角度看，固定大小的线程池更容易做容量规划和监控。

**追问2：** CPU 密集型任务的线程数一般设为 CPU 核数 + 1 ——因为 CPU 密集型任务几乎不阻塞，每个 CPU 核心可以满负荷执行一个线程，多出的一个线程作为"备用"，当某个线程因为缺页中断等原因短暂挂起时可以顶上。设再多线程没有意义，反而增加上下文切换开销。IO 密集型任务的线程数公式是 `CPU核数 × (1 + 平均等待时间/平均计算时间)` ——因为 IO 操作时线程处于阻塞状态，CPU 是空闲的，可以起更多线程让 CPU 在不同线程间切换始终保持忙碌。实际项目中这个比例很难精确测算，一个更实用的经验值是对 IO 密集型设为核心数的两倍左右，然后通过压测微调——观察 CPU 利用率、线程等待时间、任务队列积压量等指标来决策。

📌 **易错点 / 加分项：**
- 线程池的线程销毁机制：只有超过 corePoolSize 且空闲时间超过 keepAliveTime 的线程才会被回收，核心线程默认不回收（JDK 6+ 允许 `allowCoreThreadTimeOut` 回收核心线程）
- Executors 的 `newFixedThreadPool` 和 `newCachedThreadPool` 的坑——前者用无界队列可能导致 OOM，后者线程数无上限
- 线程池的 prestart 相关方法可以在线程池初始化时就把核心线程创建好，避免请求来时才创建的冷启动延迟

---

## 5. volatile 的可见性与禁止指令重排

❓ **题目：** volatile 关键字的两个核心作用是什么？它和 synchronized 在使用场景上有什么本质区别？

> 追问1：volatile 能保证原子性吗？`volatile int i = 0; i++;` 在多线程下安全吗？
> 追问2：DCL（双重检查锁）单例模式中，`instance` 为什么必须声明为 volatile？

💡 **答案：**

**主问题：** volatile 有两大核心作用：保证可见性和禁止指令重排。可见性是说一个线程修改了 volatile 变量后，新值立即对其他线程可见——底层是通过 CPU 的缓存一致性协议（MESI）和内存屏障来实现的，写 volatile 变量后插入 StoreLoad 屏障，强制将本地缓存刷新到主存；读 volatile 变量前插入 LoadLoad 和 LoadStore 屏障，强制从主存重新读取。禁止指令重排是说 volatile 变量前后的指令不会被 JIT 编译器和 CPU 打乱顺序——这由内存屏障保证。volatile 和 synchronized 的本质区别在于：volatile 只能修饰变量，解决的是"一个线程写、多个线程读"场景下的可见性问题，没有互斥和原子性；synchronized 解决的是"多个线程读写"场景下的互斥和原子性问题，同时也附带可见性保证（JMM 规定 unlock 前必须将变量刷回主存）。

**追问1：** volatile 不能保证原子性。`i++` 实际上是三步操作：读 i 的值、加 1、写回 i。volatile 只能保证每一步读到的 i 是最新值，以及在写回时其他线程能看到，但不能阻止两个线程同时读到同样的值（比如都读到 0，都加 1 写回 1，期望是 2，实际是 1）。要保证 `i++` 的原子性，要么用 synchronized，要么用 AtomicInteger（底层 CAS）。这也是 volatile 最经典的使用限制——它只适合"写入不依赖于当前值"的场景，比如状态标志位 `volatile boolean flag = true`。

**追问2：** DCL 单例中 `instance = new Singleton()` 不是原子操作，底层大致对应三条指令：分配内存空间（分配好了，instance 指向这块内存，但内容是零值）→ 执行构造方法初始化对象 → 将 instance 引用指向内存地址。问题在于 JIT 或 CPU 可能将后两步重排——先建立引用再初始化，这样 instance 就先不为 null 了但对象还没初始化完成。另一个线程在第一个 if (instance == null) 检查时看到 instance 非 null，直接返回了一个构造器还没跑完的"半成品"对象，调用时出现不可预知的错误。加 volatile 禁止了这个重排——volatile 变量的写操作后面的 StoreLoad 屏障确保"引用指向内存地址"这个动作之前，构造方法一定已经执行完毕。JDK 5 之前 volatile 语义不够强，需要额外用局部变量的 trick；JDK 5 加强了 volatile 语义后，加 volatile 就足够了。另外，如果不需要延迟加载，直接用饿汉式或者枚举单例更简单也更安全。

📌 **易错点 / 加分项：**
- volatile 不保证原子性是每次面试必问，`i++` 是最经典的例子
- 能说出 JMM 的 happens-before 规则中 volatile 写 happens-before 后续的 volatile 读，说明理论功底到位
- 枚举单例是最安全的单例方式——JVM 保证枚举的实例化是线程安全的，且序列化也不会破坏单例

---

## 6. CompletableFuture 异步编程

❓ **题目：** CompletableFuture 相比 Future，解决了哪些痛点？它的核心 API 家族是如何划分的？

> 追问1：`thenApply`、`thenCompose`、`thenAccept` 的适用场景有什么不同？`thenCompose` 存在的必要性是什么？
> 追问2：多个 CompletableFuture 并行处理后汇总结果，怎么做？如果有任意一个失败就整体失败，又怎么做？

💡 **答案：**

**主问题：** CompletableFuture 解决了 Future 的三个核心痛点：一是"阻塞获取结果"——Future 只能通过 `get()` 阻塞等待结果，CompletableFuture 支持回调方式（`thenApply`、`thenAccept`），异步结果到达后自动触发后续操作；二是"链式编排"——Future 不支持一个异步任务完成后触发另一个异步任务，CompletableFuture 通过函数式编程风格的任务链实现了 `stage1.thenCompose(result -> stage2)` 这样的任务编排；三是"多任务组合"——Future 没有方便的 `allOf` 或 `anyOf` 语义来编排多个异步任务，CompletableFuture 内置了这些组合操作。另外 CompletableFuture 还支持异常处理（`exceptionally`、`handle`——异常可恢复，`whenComplete`——结果感知）、支持"主动完成"（`complete` 方法手动设值）以及灵活的线程池指定（`thenApplyAsync` 可以选择用哪个线程池）。

**追问1：** 三者适用于不同场景。`thenApply(Function<T, U>)` 是纯数据转换——输入 T 输出 U，同步执行，不返回 CompletableFuture。比如将返回的 User 对象转换为其它的 DTO。`thenCompose(Function<T, CompletionStage<U>>)` 是异步任务连接——输入 T 返回一个 CompletableFuture，用于"当前异步任务完成后自动触发另一个异步任务"。关键区分：`thenCompose` 是"第一个任务结果拿来去开启第二个异步任务"，`thenCompose` 存在的必要性在于——如果不用它而是用 `thenApply` 返回 `CompletableFuture<CompletableFuture<U>>`，就嵌套了两层——外面是一个 Future。`thenAccept(Consumer<T>)` 是纯消费——输入 T，无返回值。用于"异步操作完成后做一些事情"（如保存日志、发送通知），不适合做数据管道。

**追问2：** 多个 CompletableFuture 并发执行后汇总——用 `CompletableFuture.allOf(f1, f2, f3)` 等待所有完成，然后通过 `f1.join()` 逐一获取结果。但 `allOf` 返回的是 `CompletableFuture<Void>`，无法直接获取结果，所以常见的模式是 `CompletableFuture.allOf(f1, f2, f3).thenApply(v -> Arrays.asList(f1.join(), f2.join(), f3.join()))`。如果任意一个失败就整体失败，不需要额外操作——`allOf` 完成的 CompletableFuture 在任一子任务抛出异常时也会异常完成，所以在 `thenApply` 中 `join()` 会抛出异常。但如果希望"所有结果都拿到"（比如有的成功有的失败但不想丢成功的），就需要在每个子任务上挂 `exceptionally` 返回 fallback 值。更复杂的场景——多个 Future 中只要有一个成功就可以前进一步——用 `anyOf`。

📌 **易错点 / 加分项：**
- CompletableFuture 的默认线程池是 `ForkJoinPool.commonPool()`，不适合 IO 密集型任务——生产环境建议传自定义线程池
- `thenCompose` 和 `flatMap`（Stream API）在概念上等价——都是"扁平化"
- `supplyAsync` 和 `runAsync` 的区别——前者有返回值（Supplier），后者无返回值（Runnable）

---

## 7. Fork/Join 框架与工作窃取

❓ **题目：** Fork/Join 框架的"工作窃取"（Work Stealing）算法是如何工作的？它适合什么类型的任务？

> 追问1：Java 的并行流（Parallel Stream）底层是如何用 Fork/Join 实现的？使用并行流有哪些常见的坑？
> 追问2：ForkJoinPool 和普通的 ThreadPoolExecutor 在内核线程使用和任务调度上有什么本质区别？

💡 **答案：**

**主问题：** Fork/Join 框架的核心思想是"大任务拆分为小任务，并行执行后归并结果"。工作窃取算法的流程是：每个工作线程都有一个双端队列存储待处理的任务。正常工作时，线程从自身队列的**尾部取任务**（LIFO，类似栈顶取），这是因为最近加入的任务缓存更热，跑起来效率更高。当一个线程把自己的队列任务都处理完了，它会"窃取"其他线程队列**头部**的任务（FIFO，窃取最旧的任务），这样被窃取的线程继续处理自己的新任务不会冲突。这种设计让线程之间的任务分布高度均衡——没有空闲线程，也没有单独的中央任务调度器。Fork/Join 最经典的使用场景是"分治"类问题：归并排序、大数组并行加工（分割求和再汇总）、树形结构的递归处理。计算密集型、可拆分为独立子问题、无共享状态的场景是它的最佳适用区。

**追问1：** Java 的并行流（如 `list.parallelStream().map(...).collect(...)`）底层用的是 `ForkJoinPool.commonPool()`，并行度默认是 CPU 核数（`Runtime.getRuntime().availableProcessors() - 1` 通常）。常见坑几个：一是"commonPool 被阻塞"——如果在并行流中执行 IO 阻塞操作，会阻塞 ForkJoinPool 的工作线程，导致整个 commonPool 的线程都不足以处理其他并行任务，整个 JVM 的并行流都停滞。二是并行流不适合小数据量——拆分和归并的开销可能大于直接串行计算，几千个元素级别时并行流反而更慢。三是线程安全问题——并行流中操作的共享变量需要加锁或用原子类，并行化后线程安全问题更隐蔽。四是 `parallelStream` 不能保证有序——除非用 `forEachOrdered` 但性能会下降。

**追问2：** 本质区别在任务调度模型和线程的内核行为。ThreadPoolExecutor 使用一个共享的阻塞队列作为任务缓冲区——所有工作线程都从同一个队列里取任务，多个线程竞争队列锁，高并发场景下队列是瓶颈。ForkJoinPool 使用工作窃取——每个线程有自己的双端队列，只在窃取时才跨线程，单个线程处理自身任务无需锁，并发度更高。在 CPU 利用率上，ForkJoinPool 的线程在无事窃取时会"等待一段时间"然后主动释放 CPU（park），被窃取线程被窃取时也不需要有实质性的锁竞争。另一个关键区别是 ForkJoinPool 的任务是 ForkJoinTask 而不是 Runnable——它们可以被递归地 fork 拆分、join 等待子任务。

📌 **易错点 / 加分项：**
- commonPool 全局共享——不能因为一个业务的需要修改 commonPool 并行度（通过 JVM 参数修改会影响所有并行流）
- ForkJoinTask 的 `invoke`、`fork`、`join` 三者的关系——`fork` 是异步提交子任务，`join` 是等待子任务结果
- RecursiveTask 有返回值，RecursiveAction 无返回值——对应 Fork/Join 中有/无归并结果的场景
