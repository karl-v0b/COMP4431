(() => {
  /**
   * Fast Check glossary: 114 course terms across 10 shallow (~2h) lecture topics
   * (counts in the topic inventory; aliases do not add entries),
   * plus 2 app extras (RAG, prompt). Longest match wins.
   */
  const entries = [
    // --- 1. Introduction to Artificial Intelligence (10) ---
    {
      terms: ["artificial intelligence", "ai"],
      display: "Artificial Intelligence (AI)",
      def: "AI is the field of building systems that perform tasks that normally need human intelligence. An intro course usually frames AI around agents that perceive and act. It is a broad umbrella of methods, not one algorithm.",
    },
    {
      terms: ["intelligent agent", "intelligent agents"],
      display: "Intelligent Agent",
      def: "An intelligent agent perceives its environment and acts to achieve goals. Sensors provide percepts; actuators apply actions. Course models often judge agents by a performance measure.",
    },
    {
      terms: ["peas"],
      display: "PEAS",
      def: "PEAS describes a task environment: Performance measure, Environment, Actuators, and Sensors. It is a checklist for specifying what an agent should do and what it can sense or affect. Clear PEAS makes agent design easier to discuss.",
    },
    {
      terms: ["rational agent", "rational agents"],
      display: "Rational Agent",
      def: "A rational agent chooses actions expected to maximize its performance measure given what it knows. Rationality is about expected success, not perfect hindsight. It depends on sensors, prior knowledge, and available actions.",
    },
    {
      terms: ["environment", "environments", "task environment"],
      display: "Environment",
      def: "The environment is everything outside the agent that it senses and acts on. Intro courses classify environments (for example observable vs partially observable). The environment type guides which agent design fits.",
    },
    {
      terms: ["percept", "percepts"],
      display: "Percept",
      def: "A percept is the agent's momentary sensory input from the environment. A percept sequence is the history of percepts so far. Agents map percepts (and history) to actions.",
    },
    {
      terms: ["sensor", "sensors"],
      display: "Sensor",
      def: "Sensors are the agent's devices or channels for receiving percepts. Camera, microphone, or API reads are examples. Limited sensors mean the agent may only partially observe the world.",
    },
    {
      terms: ["actuator", "actuators"],
      display: "Actuator",
      def: "Actuators are how the agent applies actions to the environment. Motors, displays, or API writes are examples. Without actuators, an agent can only observe, not change the world.",
    },
    {
      terms: ["performance measure", "performance measures"],
      display: "Performance Measure",
      def: "A performance measure scores how well the agent is doing in the task. It defines success for rational choice. Designing the measure carefully matters because the agent optimizes that score.",
    },
    {
      terms: ["turing test"],
      display: "Turing Test",
      def: "The Turing test asks whether a machine's conversational behavior is indistinguishable from a human's to a judge. It is a historical idea about thinking machines, not a modern training metric. Passing it is neither necessary nor sufficient for all AI goals.",
    },

    // --- 2. Heuristic Search (14) ---
    {
      terms: ["state space", "state-space"],
      display: "State Space",
      def: "A state space is the set of possible configurations a search problem can reach. Actions define transitions between states. Search algorithms explore this space toward a goal.",
    },
    {
      terms: ["frontier", "fringe"],
      display: "Frontier",
      def: "The frontier (fringe) is the set of nodes generated but not yet expanded. Search strategies differ mainly in which frontier node they expand next. Managing the frontier controls memory and exploration order.",
    },
    {
      terms: ["uninformed search", "blind search"],
      display: "Uninformed Search",
      def: "Uninformed search uses no goal-distance heuristic—only the problem definition. BFS, DFS, and uniform-cost search are common examples. It explores systematically without domain estimates.",
    },
    {
      terms: ["informed search"],
      display: "Informed Search",
      def: "Informed search uses a heuristic that estimates cost or distance to the goal. Greedy best-first search and A* are classic examples. Better heuristics usually mean less wasted exploration.",
    },
    {
      terms: ["breadth-first search", "breadth first search", "bfs"],
      display: "Breadth-First Search (BFS)",
      def: "BFS explores level by level using a queue. If all step costs are equal, the first goal found is optimal. It can use a lot of memory on wide frontiers.",
    },
    {
      terms: ["depth-first search", "depth first search", "dfs"],
      display: "Depth-First Search (DFS)",
      def: "DFS explores as deep as possible along one branch before backtracking, usually with a stack. It often uses less memory than BFS but is not optimal in general. It can struggle with deep or infinite paths.",
    },
    {
      terms: ["uniform-cost search", "uniform cost search", "ucs"],
      display: "Uniform-Cost Search (UCS)",
      def: "Uniform-cost search expands the lowest path-cost node first. It is optimal for non-negative step costs. It ignores heuristics and only uses g(n).",
    },
    {
      terms: ["heuristic", "heuristics", "heuristic function"],
      display: "Heuristic",
      def: "A heuristic is a practical estimate that guides search. In informed search, h(n) estimates remaining cost from a node to the goal. Good heuristics speed search when used in algorithms like A*.",
    },
    {
      terms: ["greedy best-first search", "greedy best first search", "best-first search"],
      display: "Greedy Best-First Search",
      def: "Greedy best-first search expands the node that looks closest to the goal by h(n) alone. It can be fast but is not optimal in general. Misleading heuristics can lead it astray.",
    },
    {
      terms: ["a* search", "a* algorithm", "a-star", "a*"],
      display: "A* Search",
      def: "A* expands nodes by f(n) = g(n) + h(n). With an admissible heuristic it can find optimal paths in standard graph-search settings. It combines path cost so far with a goal estimate.",
    },
    {
      terms: ["g(n)"],
      display: "g(n)",
      def: "g(n) is the cost of the path from the start node to node n. Uniform-cost search expands by smallest g(n). In A*, g(n) is added to h(n) to form f(n).",
    },
    {
      terms: ["h(n)"],
      display: "h(n)",
      def: "h(n) is the heuristic estimate of cost from node n to a goal. Informed search uses h(n) to guide expansion. If h(n) = 0 always, A* behaves like uniform-cost search.",
    },
    {
      terms: ["f(n)"],
      display: "f(n)",
      def: "In A*, f(n) = g(n) + h(n) estimates the total cost of a path through n. A* expands the frontier node with smallest f(n). It balances what is already spent and what is estimated to remain.",
    },
    {
      terms: ["admissible heuristic", "admissible"],
      display: "Admissible Heuristic",
      def: "An admissible heuristic never overestimates the true cost to the goal. Admissibility supports A* optimality under standard assumptions. It may still underestimate.",
    },

    // --- 3. Knowledge based agent & Expert System (11) ---
    {
      terms: ["knowledge-based agent", "knowledge based agent", "knowledge-based agents"],
      display: "Knowledge-Based Agent",
      def: "A knowledge-based agent maintains a knowledge base and decides actions by inference. New percepts are told to the KB; answers are asked from it. It separates knowledge from the reasoning procedure.",
    },
    {
      terms: ["knowledge base", "kb"],
      display: "Knowledge Base (KB)",
      def: "A knowledge base stores sentences or facts the agent believes. The agent adds sentences (TELL) and queries them (ASK). Inference derives new conclusions from the KB.",
    },
    {
      terms: ["inference", "reasoning"],
      display: "Inference",
      def: "Inference is deriving new conclusions from known facts or rules. Knowledge-based agents use inference to answer queries and choose actions. Sound inference preserves truth of entailed conclusions.",
    },
    {
      terms: ["expert system", "expert systems"],
      display: "Expert System",
      def: "An expert system encodes specialist knowledge to advise or decide in a narrow domain. Classic designs use rules plus an inference engine. They aim to mimic an expert's conclusions, not general intelligence.",
    },
    {
      terms: ["rule-based system", "rule based system", "rule-based systems"],
      display: "Rule-Based System",
      def: "A rule-based system represents knowledge as if–then rules. Matching conditions can fire actions or conclusions. Many expert systems are rule-based.",
    },
    {
      terms: ["inference engine"],
      display: "Inference Engine",
      def: "The inference engine applies rules or logic procedures to the knowledge base. It is the reasoning component separate from the stored facts. Forward and backward chaining are common control styles.",
    },
    {
      terms: ["working memory"],
      display: "Working Memory",
      def: "Working memory holds the current facts or case data being reasoned about. Rules match against working memory contents. It changes as new conclusions are asserted.",
    },
    {
      terms: ["forward chaining"],
      display: "Forward Chaining",
      def: "Forward chaining starts from known facts and fires applicable rules to derive new facts. It is data-driven inference. It continues until a goal is reached or no rules apply.",
    },
    {
      terms: ["backward chaining"],
      display: "Backward Chaining",
      def: "Backward chaining starts from a goal query and works backward to find supporting facts or subgoals. It is goal-driven inference. It fits expert-system yes/no questions about a goal claim.",
    },
    {
      terms: ["entailment", "entails"],
      display: "Entailment",
      def: "Entailment means a set of sentences logically guarantees another sentence. If KB entails α, then α must be true whenever KB is true. Inference algorithms try to determine entailment.",
    },
    {
      terms: ["horn clause", "horn clauses"],
      display: "Horn Clause",
      def: "A Horn clause is a restricted logical form that supports efficient chaining inference. Many rule systems use Horn-like rules (one positive conclusion). They trade expressiveness for tractable reasoning.",
    },

    // --- 4. Hill Climbing, Simulated Annealing and GA (12) ---
    {
      terms: ["local search"],
      display: "Local Search",
      def: "Local search improves a current state by moving to better neighbors without keeping a full frontier. Hill climbing, simulated annealing, and genetic algorithms are local or population-based variants. It uses little memory compared with systematic search.",
    },
    {
      terms: ["hill climbing", "hill-climbing"],
      display: "Hill Climbing",
      def: "Hill climbing repeatedly moves to a neighbor with better objective value. It is simple and fast but can stop at a local optimum. Random restarts are a common fix in shallow courses.",
    },
    {
      terms: ["local optimum", "local optima", "local maximum", "local minimum"],
      display: "Local Optimum",
      def: "A local optimum is best among neighbors but not necessarily best overall. Hill climbing can get stuck there. Escaping it needs jumps, randomness, or restarts.",
    },
    {
      terms: ["global optimum", "global optima", "global maximum", "global minimum"],
      display: "Global Optimum",
      def: "A global optimum is the best solution in the whole search space. Local methods do not guarantee finding it. Hard landscapes make global optimality difficult.",
    },
    {
      terms: ["plateau"],
      display: "Plateau",
      def: "A plateau is a flat region where neighbors look equally good. Hill climbing gets little guidance there and may wander. Sideways moves or randomness can help leave a plateau.",
    },
    {
      terms: ["simulated annealing", "sa"],
      display: "Simulated Annealing",
      def: "Simulated annealing sometimes accepts worse moves to escape local optima. Acceptance chance falls as a temperature parameter cools. It borrows the metaphor of annealing in metallurgy.",
    },
    {
      terms: ["cooling schedule"],
      display: "Cooling Schedule",
      def: "The cooling schedule controls how temperature decreases over time in simulated annealing. High temperature allows more uphill/worse moves early. Too-fast cooling can freeze into a poor local optimum.",
    },
    {
      terms: ["genetic algorithm", "genetic algorithms", "ga"],
      display: "Genetic Algorithm (GA)",
      def: "A genetic algorithm evolves a population of candidate solutions using selection, crossover, and mutation. Fitter individuals are more likely to reproduce. It is a stochastic global-ish search heuristic.",
    },
    {
      terms: ["population"],
      display: "Population",
      def: "In a GA, the population is the current set of candidate solutions (individuals). Search improves the population over generations. Diversity in the population helps exploration.",
    },
    {
      terms: ["fitness function", "fitness"],
      display: "Fitness Function",
      def: "The fitness function scores how good an individual is for the GA. Selection prefers higher fitness. It plays the role of the objective in evolutionary search.",
    },
    {
      terms: ["crossover", "recombination"],
      display: "Crossover",
      def: "Crossover combines parts of two parent solutions to make offspring. It reuses building blocks already found in the population. Different encodings use different crossover operators.",
    },
    {
      terms: ["mutation"],
      display: "Mutation",
      def: "Mutation randomly changes an individual to introduce new variation. It helps the GA explore and avoid premature convergence. Mutation rates are usually kept small.",
    },

    // --- 5. Constraints and games (13) ---
    {
      terms: ["constraint satisfaction problem", "constraint satisfaction problems", "csp", "csps"],
      display: "Constraint Satisfaction Problem (CSP)",
      def: "A CSP asks for assignments to variables that satisfy constraints. Map coloring and scheduling are classic examples. Solving often uses backtracking plus simple inference.",
    },
    {
      terms: ["csp variable", "variable (csp)", "variables (csp)"],
      display: "Variable (CSP)",
      def: "In a CSP, each variable is something that needs a value assigned. The full assignment must meet all constraints. Variable ordering heuristics can speed search.",
    },
    {
      terms: ["domain (csp)", "csp domain", "domains (csp)"],
      display: "Domain (CSP)",
      def: "A variable's domain is the set of values it may take. Search tries values from domains while respecting constraints. Inference can shrink domains before or during search.",
    },
    {
      terms: ["constraint", "constraints"],
      display: "Constraint",
      def: "A constraint restricts allowed combinations of variable values. Binary constraints involve two variables; unary involve one. CSP solving means finding an assignment that satisfies every constraint.",
    },
    {
      terms: ["backtracking"],
      display: "Backtracking",
      def: "Backtracking builds a partial assignment and undoes a choice when it fails. It is the standard systematic CSP search. Good ordering and checking reduce the tree size.",
    },
    {
      terms: ["forward checking"],
      display: "Forward Checking",
      def: "Forward checking, after assigning a variable, deletes incompatible values from neighbors' domains. If a domain empties, the assignment fails early. It is lightweight inference during backtracking.",
    },
    {
      terms: ["arc consistency", "arc-consistency"],
      display: "Arc Consistency",
      def: "Arc consistency requires that every value of one variable has a supporting value in a related variable. Enforcing it prunes impossible domain values. It is a common CSP inference idea at intro level.",
    },
    {
      terms: ["game tree"],
      display: "Game Tree",
      def: "A game tree represents possible moves and countermoves from a position. Nodes are states; edges are moves. Minimax and alpha-beta search this tree.",
    },
    {
      terms: ["zero-sum game", "zero sum game"],
      display: "Zero-Sum Game",
      def: "In a zero-sum game, one player's gain equals the other's loss. Chess-like teaching examples are often treated as zero-sum. Minimax assumes opposing interests of this form.",
    },
    {
      terms: ["minimax"],
      display: "Minimax",
      def: "Minimax chooses a move assuming an optimal opponent in two-player zero-sum games. It maximizes the worst-case outcome for the current player. Leaf values come from a terminal utility or evaluation.",
    },
    {
      terms: ["alpha-beta pruning", "alpha beta pruning"],
      display: "Alpha-Beta Pruning",
      def: "Alpha-beta pruning skips branches that cannot affect the minimax decision. It returns the same move as full minimax when applied correctly. Better move ordering increases pruning.",
    },
    {
      terms: ["evaluation function", "heuristic evaluation"],
      display: "Evaluation Function",
      def: "An evaluation function estimates how good a non-terminal game position is. It lets search cut off before the true end of the game. Quality of play depends heavily on this heuristic.",
    },
    {
      terms: ["ply"],
      display: "Ply",
      def: "A ply is one half-move by one player in a game tree. Depth limits are often counted in plies. Deeper ply search usually means stronger play if time allows.",
    },

    // --- 6. Machine Learning (13) ---
    {
      terms: ["machine learning", "ml"],
      display: "Machine Learning (ML)",
      def: "Machine learning lets programs improve from data instead of only hand-written rules. Common types are supervised, unsupervised, and reinforcement learning. Models aim to generalize to new inputs.",
    },
    {
      terms: ["supervised learning"],
      display: "Supervised Learning",
      def: "Supervised learning trains on labeled examples (input → correct output). The goal is to predict labels for new inputs. Classification and regression are the main task types.",
    },
    {
      terms: ["unsupervised learning"],
      display: "Unsupervised Learning",
      def: "Unsupervised learning finds structure in data without labels. Clustering is a typical example at intro level. It is used for exploration and pattern discovery.",
    },
    {
      terms: ["reinforcement learning", "rl"],
      display: "Reinforcement Learning (RL)",
      def: "Reinforcement learning trains an agent via reward and penalty through interaction. The agent learns a policy that improves long-term reward. It differs from supervised label fitting.",
    },
    {
      terms: ["training set", "training data"],
      display: "Training Set",
      def: "The training set is the data used to fit model parameters. Learning algorithms optimize performance on this set (plus regularization). Using only training score can hide overfitting.",
    },
    {
      terms: ["test set", "test data"],
      display: "Test Set",
      def: "The test set estimates performance on unseen data after training. It should not be used to tune the model repeatedly. A held-out test set checks generalization.",
    },
    {
      terms: ["feature", "features"],
      display: "Feature",
      def: "A feature is an input attribute used by a learning model. Feature choice often matters as much as the algorithm. Poor features limit even strong models.",
    },
    {
      terms: ["classification"],
      display: "Classification",
      def: "Classification predicts a discrete label for an input. Spam vs not-spam is a classic example. Accuracy and related metrics measure performance.",
    },
    {
      terms: ["regression"],
      display: "Regression",
      def: "Regression predicts a continuous numeric value from inputs. House-price prediction is a common example. Squared error is a frequent training loss.",
    },
    {
      terms: ["overfitting"],
      display: "Overfitting",
      def: "Overfitting means a model fits training data too closely and fails on new data. Complex models and small datasets raise the risk. Simpler models, more data, or regularization help.",
    },
    {
      terms: ["underfitting"],
      display: "Underfitting",
      def: "Underfitting means a model is too simple to capture the pattern in the data. Both training and test performance stay weak. A richer model or better features is usually needed.",
    },
    {
      terms: ["decision tree", "decision trees"],
      display: "Decision Tree",
      def: "A decision tree classifies or regresses by asking a sequence of feature questions. Each root-to-leaf path is a rule. Trees are readable but can overfit if grown too deep.",
    },
    {
      terms: ["support vector machine", "support vector machines", "svm", "svms"],
      display: "Support Vector Machine (SVM)",
      def: "An SVM finds a decision boundary with a large margin between classes. Support vectors are the critical points near the boundary. Kernels allow non-linear separation.",
    },

    // --- 7. Neural Networks (11) ---
    {
      terms: ["artificial neuron", "neuron"],
      display: "Artificial Neuron",
      def: "An artificial neuron computes a weighted sum of inputs plus bias, then applies an activation. Many neurons connect into a network. It is a simplified computational unit, not a full biological cell model.",
    },
    {
      terms: ["perceptron"],
      display: "Perceptron",
      def: "The perceptron is an early linear binary classifier made from a single neuron-like unit. It learns weights from labeled examples. Alone it cannot solve non-linearly separable problems.",
    },
    {
      terms: ["neural network", "neural networks", "neural net", "neural nets", "ann"],
      display: "Neural Network",
      def: "A neural network is a model of layered units that map inputs to outputs. Weights are learned from data, often with gradient methods. Depth and width control capacity.",
    },
    {
      terms: ["activation function", "activation functions", "activation"],
      display: "Activation Function",
      def: "An activation function introduces non-linearity after a neuron's weighted sum. Sigmoid, tanh, and ReLU are common examples. Without non-linear activations, deep stacks collapse to a linear map.",
    },
    {
      terms: ["weight", "weights"],
      display: "Weight",
      def: "Weights are the learnable connection strengths between units. Training adjusts weights to reduce loss. They store most of what the network has learned.",
    },
    {
      terms: ["bias (model)", "bias term", "bias parameter"],
      display: "Bias (Model Parameter)",
      def: "A bias term shifts a neuron's activation threshold. It is a learnable parameter alongside weights. It is not the same idea as social or dataset bias.",
    },
    {
      terms: ["hidden layer", "hidden layers"],
      display: "Hidden Layer",
      def: "A hidden layer sits between input and output layers. It builds intermediate representations of the data. Multiple hidden layers increase the network's expressive power.",
    },
    {
      terms: ["feedforward network", "feedforward neural network", "feed-forward network"],
      display: "Feedforward Network",
      def: "In a feedforward network, information flows one way from inputs to outputs without cycles. Multilayer perceptrons are feedforward. Recurrent nets differ by feeding state back over time.",
    },
    {
      terms: ["loss function", "loss", "cost function"],
      display: "Loss Function",
      def: "A loss function measures how far predictions are from targets. Training minimizes average loss on the training data. Cross-entropy and squared error are common choices.",
    },
    {
      terms: ["gradient descent"],
      display: "Gradient Descent",
      def: "Gradient descent updates parameters by stepping opposite the loss gradient. Learning rate controls step size. It is the basic optimizer behind many neural network trainers.",
    },
    {
      terms: ["backpropagation", "backprop", "backward propagation"],
      display: "Backpropagation",
      def: "Backpropagation computes gradients of the loss with respect to each weight efficiently. It applies the chain rule layer by layer backward. Those gradients drive gradient descent updates.",
    },

    // --- 8. Deep Learning (8) ---
    {
      terms: ["deep learning", "dl"],
      display: "Deep Learning",
      def: "Deep learning trains neural networks with many layers to learn hierarchical features. It powers modern vision and language systems when data and compute allow. Depth is the key contrast with shallow nets.",
    },
    {
      terms: ["deep neural network", "deep neural networks", "dnn"],
      display: "Deep Neural Network (DNN)",
      def: "A deep neural network has multiple hidden layers stacked together. Intermediate layers can learn increasingly abstract features. Training needs enough data, compute, and careful optimization.",
    },
    {
      terms: ["representation learning"],
      display: "Representation Learning",
      def: "Representation learning automatically builds useful features from raw inputs. Deep nets are often used for this instead of hand-crafted features. Better representations make downstream tasks easier.",
    },
    {
      terms: ["convolutional neural network", "convolutional neural networks", "cnn", "cnns"],
      display: "Convolutional Neural Network (CNN)",
      def: "A CNN uses convolution layers that detect local patterns and reuse filters across positions. It suits grid-like data such as images. Pooling often follows to reduce spatial size.",
    },
    {
      terms: ["pooling", "max pooling", "average pooling"],
      display: "Pooling",
      def: "Pooling downsamples feature maps by summarizing local regions (for example max pooling). It reduces size and can add local translation robustness. It is common in CNN pipelines.",
    },
    {
      terms: ["vanishing gradient", "vanishing gradients"],
      display: "Vanishing Gradient",
      def: "Vanishing gradients shrink as they propagate backward through many layers. Early layers then learn very slowly. Careful activations, init, and architectures help reduce the problem.",
    },
    {
      terms: ["dropout"],
      display: "Dropout",
      def: "Dropout randomly disables units during training to reduce co-adaptation. It acts as a regularizer against overfitting. At test time, full networks are usually used with scaled weights.",
    },
    {
      terms: ["transfer learning"],
      display: "Transfer Learning",
      def: "Transfer learning reuses a model trained on one task as a starting point for another. Fine-tuning a pretrained net is a common pattern. It helps when the new labeled set is small.",
    },

    // --- 9. Bayesian (10) ---
    {
      terms: ["prior probability", "prior"],
      display: "Prior Probability",
      def: "A prior is the belief about a hypothesis before seeing the new evidence. Bayes' theorem updates the prior into a posterior. Strong priors matter when data are scarce.",
    },
    {
      terms: ["likelihood"],
      display: "Likelihood",
      def: "Likelihood measures how probable the evidence is under a hypothesis. In Bayes' theorem it multiplies the prior. It is P(evidence | hypothesis), not the posterior.",
    },
    {
      terms: ["posterior probability", "posterior"],
      display: "Posterior Probability",
      def: "The posterior is the updated belief after seeing evidence. Bayes' theorem combines prior and likelihood to get the posterior. Decision-making often uses posterior probabilities.",
    },
    {
      terms: ["conditional probability"],
      display: "Conditional Probability",
      def: "Conditional probability P(A|B) is the probability of A given that B is true. It is the basic language of Bayesian updating. Independence assumptions simplify conditional models.",
    },
    {
      terms: ["bayes' theorem", "bayes theorem", "bayes' rule", "bayes rule"],
      display: "Bayes' Theorem",
      def: "Bayes' theorem relates prior, likelihood, and posterior: posterior ∝ likelihood × prior. It is the core update rule for uncertain beliefs. Many classifiers and networks apply this idea.",
    },
    {
      terms: ["independence", "statistical independence", "independent events"],
      display: "Independence",
      def: "Two variables are independent if knowing one does not change the probability of the other. Conditional independence given a third variable is also common. Independence assumptions make Bayesian models tractable.",
    },
    {
      terms: ["joint probability", "joint distribution", "joint probability distribution"],
      display: "Joint Probability",
      def: "A joint distribution assigns probabilities to combinations of variables. Marginal and conditional probabilities can be derived from it. Full joints grow large, so structured models are used.",
    },
    {
      terms: ["bayesian network", "bayesian networks", "belief network", "bayes net"],
      display: "Bayesian Network",
      def: "A Bayesian network is a directed graph representing conditional dependencies among variables. Each node has a local conditional probability table. It encodes a compact joint distribution.",
    },
    {
      terms: ["naive bayes", "naïve bayes", "naive bayes classifier"],
      display: "Naive Bayes",
      def: "Naive Bayes classifies using Bayes' theorem with a strong conditional-independence assumption among features. It is simple and often works surprisingly well. The “naive” part is that independence assumption.",
    },
    {
      terms: ["marginalization", "marginal probability"],
      display: "Marginalization",
      def: "Marginalization sums (or integrates) a joint distribution to get a probability over fewer variables. It removes variables you do not need to condition on. Inference in Bayesian models often uses marginalization.",
    },

    // --- 10. Sequential Modeling and Transformer (12) ---
    {
      terms: ["sequence model", "sequence models", "sequential model"],
      display: "Sequence Model",
      def: "A sequence model predicts or represents ordered data such as text or time series. It must use context from earlier (and sometimes later) positions. RNNs and transformers are common sequence models.",
    },
    {
      terms: ["recurrent neural network", "recurrent neural networks", "rnn", "rnns"],
      display: "Recurrent Neural Network (RNN)",
      def: "An RNN feeds hidden state from one time step into the next. That recurrence helps model sequences of variable length. Plain RNNs can struggle with long-range dependencies.",
    },
    {
      terms: ["lstm", "long short-term memory", "long short term memory"],
      display: "LSTM",
      def: "LSTM is a recurrent architecture with gates that control memory over time. It handles longer dependencies better than a vanilla RNN in many tasks. It was a standard sequence model before transformers dominated NLP.",
    },
    {
      terms: ["attention"],
      display: "Attention",
      def: "Attention lets a model focus on relevant parts of the input when producing an output. It computes weighted combinations of value vectors. Transformers use attention as their main building block.",
    },
    {
      terms: ["self-attention", "self attention"],
      display: "Self-Attention",
      def: "Self-attention relates positions within the same sequence to each other. Each token can gather information from other tokens. It is central to the transformer architecture.",
    },
    {
      terms: ["transformer", "transformers"],
      display: "Transformer",
      def: "A transformer is a sequence model built from stacked self-attention and feedforward layers. It processes tokens in parallel rather than step-by-step recurrence. It is the basis of many modern language models.",
    },
    {
      terms: ["encoder"],
      display: "Encoder",
      def: "An encoder maps an input sequence into continuous representations. In encoder–decoder transformers it understands the source side. Encoder-only models are also common for classification.",
    },
    {
      terms: ["decoder"],
      display: "Decoder",
      def: "A decoder generates an output sequence, often attending to encoder states. In language models, decoder-only stacks predict the next token. Masking prevents attending to future tokens during training.",
    },
    {
      terms: ["word embedding", "word embeddings", "word vector"],
      display: "Word Embedding",
      def: "A word embedding maps tokens into dense vectors that capture similarity. Nearby vectors often mean related meaning. Embeddings are the usual first layer of NLP neural models.",
    },
    {
      terms: ["positional encoding", "position encoding", "positional embeddings"],
      display: "Positional Encoding",
      def: "Positional encoding injects order information into transformer inputs. Self-attention alone has no built-in sense of position. Sinusoidal or learned position vectors are common approaches.",
    },
    {
      terms: ["softmax"],
      display: "Softmax",
      def: "Softmax turns a vector of scores into a probability distribution that sums to one. It is used in attention weights and multi-class output layers. Larger scores get exponentially more probability mass.",
    },
    {
      terms: ["token", "tokens"],
      display: "Token",
      def: "A token is a chunk of text a language model reads or writes, often a word piece. Sequences are lists of tokens. Model limits are usually counted in tokens.",
    },

    // --- App extras (not part of the 108 course total) ---
    {
      terms: ["rag", "retrieval-augmented generation", "retrieval augmented generation"],
      display: "Retrieval-Augmented Generation (RAG)",
      def: "RAG retrieves relevant documents and feeds them into the model as context for answering. This tutor uses RAG for uploaded lecture PDFs. Chunk quality and retrieval strongly affect answers.",
    },
    {
      terms: ["prompt", "prompts", "system prompt"],
      display: "Prompt",
      def: "A prompt is the instruction or context given to a language model. A system prompt sets role and rules; user messages ask the question. Clear prompts improve answer quality.",
    },
  ];

  const byKey = new Map();
  for (const entry of entries) {
    const payload = { display: entry.display, def: entry.def };
    for (const term of entry.terms) {
      const key = term.toLowerCase().trim();
      if (!byKey.has(key)) byKey.set(key, payload);
    }
  }

  const keysLongestFirst = Array.from(byKey.keys()).sort((a, b) => b.length - a.length);

  window.AI_TUTOR_GLOSSARY = {
    byKey,
    keysLongestFirst,
    courseEntryCount: 114,
    appExtraCount: 2,
  };
})();
