import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "ai-foundations" as const;

export const aiFoundations: Topic = {
  id: T,
  name: "AI Foundations",
  emoji: "🧠",
  tagline: "What AI is, how it learns, and why it works (or doesn't).",
  color: "#7c5cff",
  visual: "neural",
  levels: [
    level(T, 1, "What is AI, really?", "Build a working mental model of AI.", 5, [
      spark("AI is pattern, not magic", {
        type: "microread",
        title: "AI is pattern, not magic",
        body: "AI is software that learns patterns from examples instead of being told the rules. Show it 100,000 cat photos labeled 'cat' and it learns the statistical fingerprint of 'cat'. New photo arrives — it scores how cat-like it looks. That's it. No spark of consciousness. The 'magic' is scale: huge datasets, huge models, and clever math (gradient descent) that nudges billions of knobs until the predictions get good.",
        takeaway: "AI = learned patterns at scale, not programmed rules.",
        bodyByAgeBand: {
          // Sprint #2 seed — proves the kid-voice rules from
          // docs/content-freshness.md §4 work. Same takeaway, simpler
          // language and examples (Pokémon vs cat photos), no companies.
          kid: "AI is just a computer that gets really good at noticing patterns. Imagine you show it 100,000 pictures and tell it which ones are Pokémon and which aren't. After enough examples, it can guess on a new picture all by itself. Nobody had to write rules like 'if it has a tail, it might be Pikachu' — it figured that out by looking. The 'AI' part isn't magic. It's *practice at scale*.",
          teen: "AI is software that learns patterns from examples, not from rules someone typed. Feed it 100,000 photos of cats and it builds its own fingerprint for what cat-shaped looks like. Then it can score a new photo without anyone teaching it edges, whiskers, or fur. The 'intelligence' is really pattern-matching at huge scale — billions of tiny dials nudged until the guesses get better.",
        },
        category: "principle",
        addedAt: "2026-04-15",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "What does an AI model do at its core?",
        options: [
          "Follows hand-coded rules a human wrote",
          "Predicts an output from patterns it learned",
          "Searches the internet in real time",
          "Stores answers in a giant lookup table",
        ],
        answer: 1,
        explain: "Models predict; they don't store rules. Patterns + math = prediction.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "When an AI surprises you, ask: 'what pattern in the training data would explain this?' That single question demystifies most weird outputs.",
        bonusXP: 5,
        category: "principle",
        addedAt: "2025-10-01",
      }),
      // Sprint #2 seed — YouTube source-anchored Spark. Pilot content
      // per docs/content-freshness.md §7. Marked SEED — a human must
      // verify the video URL + timestamp + exact quote before public
      // ship. The pattern is the deliverable here, not the specific
      // attribution.
      spark("3Blue1Brown: why attention works", {
        type: "youtubenugget",
        quote:
          "Attention is doing something deceptively simple. Each token asks every other token a question, gets an answer weighted by relevance, and updates its own meaning. The magic isn't the math — it's that the questions and answers are themselves learned.",
        takeaway: "Attention is *learned* questions and answers between tokens, not just weighted averaging.",
        source: {
          platform: "youtube",
          videoUrl: "https://www.youtube.com/@3blue1brown", // SEED — VERIFY: replace with actual video URL
          videoTitle: "Attention, Revisited",
          channelName: "3Blue1Brown",
          publishedAt: "2026-04-11",
          durationMinutes: 24,
          timestamp: "08:55",
        },
        category: "principle",
        addedAt: "2026-05-01",
      }),
      spark("Match the type", {
        type: "patternmatch",
        prompt: "Match each AI flavor to what it does",
        pairs: [
          { left: "Classifier", right: "Picks a label" },
          { left: "Regressor", right: "Predicts a number" },
          { left: "Generator", right: "Creates new content" },
          { left: "Recommender", right: "Suggests next item" },
        ],
        explain: "Most products combine 2–3 of these.",
      }),
    ]),
    level(T, 2, "Training vs Inference", "Tell apart the two phases that matter.", 4, [
      spark("Two-phase life", {
        type: "microread",
        title: "Train once, infer forever",
        body: "Training is the slow, expensive phase: feed the model billions of examples and adjust its weights. It costs millions and takes weeks. Inference is what happens every time you call the model — it just runs the math on your input. Inference is cheap (milliseconds) but you do it billions of times. Almost all production cost lives in inference, not training. That's why latency, batching, and model size matter so much.",
        takeaway: "Training shapes the brain once. Inference uses it constantly.",
        bodyByAgeBand: {
          kid: "AI has two stages, like learning a sport. Training is practice — slow, hard, takes weeks, and you only do it once. The model studies billions of examples until it gets good. Inference is the actual game — quick, easy, you do it every time someone asks the AI a question. Practice is rare and expensive. Playing the game happens a million times a day. That's why making each game faster matters way more than making practice fancier.",
          teen: "AI has two phases. Training is the slow, expensive part: show the model billions of examples and adjust its weights until predictions get good. That takes weeks and costs millions. Inference is what happens every time you ask it something — it just runs the math on your input in milliseconds. Training happens rarely. Inference happens constantly. So almost all the cost (and engineering attention) goes into making each inference faster, smaller, and cheaper.",
        },
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Where does cost hide?", {
        type: "quickpick",
        prompt: "For a popular AI app, which usually costs more over a year?",
        options: ["Training the model", "Storing the model", "Running inference", "The website hosting"],
        answer: 2,
        explain: "Inference scales with users. Training is a one-time (or rare) hit.",
      }),
      spark("Fill the stack", {
        type: "fillstack",
        prompt: "When you call an AI API, you are paying for ___.",
        options: ["training", "inference", "fine-tuning", "labeling"],
        answer: 1,
        explain: "Each API call is one inference run.",
      }),
    ]),
    level(T, 3, "Data: the real moat", "Why data quality beats model size.", 4, [
      spark("Garbage in, garbage out", {
        type: "microread",
        title: "Data is the model",
        body: "Two teams use the exact same model architecture. Team A trains on a noisy scrape; team B curates 100k high-signal examples and dedupes carefully. Team B wins, often by a landslide. Modern AI proved a hard truth: cleaner, more diverse data beats more parameters. That's why frontier labs spend nine figures on data labeling, and why your fine-tune lives or dies by the 200 examples you hand-pick.",
        takeaway: "Better data > bigger model. Almost always.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Before fine-tuning, hand-write 50 ideal input/output pairs yourself. If you can't write 50 good ones, the task isn't ready for AI yet — clarify it first.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Scenario", {
        type: "scenario",
        setup: "Your demo model hallucinates customer names half the time. Your boss says 'just train a bigger model'.",
        prompt: "Best first move?",
        options: [
          "Switch to a 10x bigger base model",
          "Audit and clean the training data first",
          "Add more GPUs to inference",
          "Lower the temperature to 0",
        ],
        answer: 1,
        explain: "Hallucinations almost always trace back to data gaps. Bigger model just hallucinates more confidently.",
      }),
    ]),
    level(T, 4, "Bias and limits", "What AI struggles with — and why.", 4, [
      spark("Mirrors of the data", {
        type: "microread",
        title: "Bias isn't a bug — it's the data",
        body: "If 80% of your hiring data shows men in engineering roles, the model learns 'male = engineer'. It's not malicious; it's statistical. AI inherits every skew, gap, and stereotype baked into its training corpus. The fix isn't a clever algorithm — it's curating the data, evaluating against fairness slices, and being honest about what your model can't do well.",
        takeaway: "Models reflect their data. Audit the data, not just the output.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "Why does an AI model sometimes seem biased?",
        options: [
          "It has its own opinions",
          "It learned patterns from skewed data",
          "Its compiler is broken",
          "Random number generators",
        ],
        answer: 1,
        explain: "Skewed data → skewed predictions. Always.",
      }),
      spark("Align before superintelligence", {
        type: "podcastnugget",
        creatorId: "lenny",
        quote:
          "Once we get to superintelligence, it will be too late to align the models. My best granularity forecast for could we have an X-risk or extremely bad outcome is somewhere between 0 and 10%.",
        takeaway:
          "Alignment work is a now problem, not a future one. The window to bake values into a system closes the moment that system gets smarter than you.",
        source: {
          podcast: "Lenny's Podcast",
          podcastUrl: "https://www.lennysnewsletter.com/podcast",
          guest: "Benjamin Mann",
          guestRole: "co-founder of Anthropic",
          episodeTitle: "Inside Anthropic — alignment, scaling, AGI timelines",
          timestamp: "00:00:32",
        },
      }),
    ]),
    level(T, 5, "Generative vs predictive", "Two families, two playbooks.", 4, [
      spark("The split", {
        type: "microread",
        title: "Predict labels vs make stuff",
        body: "Predictive AI says 'is this fraud? yes/no, 0.92 confidence'. Generative AI says 'write me a fraud-alert email in the customer's tone'. Predictive needs labeled data and crisp metrics (accuracy, F1). Generative needs evals and taste — there's no single right answer. Most modern AI products mix both: a generative core wrapped in predictive guardrails (toxicity classifier, PII detector, retrieval relevance scorer).",
        takeaway: "Predictive picks. Generative produces. Real products use both.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Match", {
        type: "patternmatch",
        prompt: "Pair each task with its family",
        pairs: [
          { left: "Spam filter", right: "Predictive" },
          { left: "Email draft", right: "Generative" },
          { left: "Image caption", right: "Generative" },
          { left: "Credit score", right: "Predictive" },
        ],
        explain: "If output is a label/number → predictive. If it's new content → generative.",
      }),
    ]),
    level(T, 6, "Embeddings 101", "Turning meaning into math.", 5, [
      spark("Vectors of meaning", {
        type: "microread",
        title: "Words as coordinates",
        body: "An embedding turns text (or images, audio) into a list of numbers — a vector — where similar things land near each other in space. 'King' and 'queen' end up close. 'King' minus 'man' plus 'woman' lands near 'queen'. This is the trick behind semantic search, recommendations, deduplication, RAG, and most 'AI search' you see today. The model doesn't 'know' meaning — it just learned to place related things nearby.",
        takeaway: "Embeddings = meaning encoded as nearby points in space.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Cosine similarity > 0.85 usually means 'very related'. Below 0.5 means 'probably unrelated'. Tune this threshold per use case — it's the most under-tuned dial in RAG systems.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "What's the main use of embeddings?",
        options: [
          "To compress images for faster loading",
          "To represent meaning so you can compare things mathematically",
          "To translate code between languages",
          "To encrypt data",
        ],
        answer: 1,
        explain: "Embeddings power semantic similarity — the heart of search and RAG.",
      }),
      spark("Build it", {
        type: "buildcard",
        title: "Build: tiny semantic search",
        pitch: "20 lines. You'll feel why embeddings are magic.",
        promptToCopy:
          "Build a tiny CLI tool in Python that takes a folder of .txt files, embeds each one with a free model (sentence-transformers/all-MiniLM-L6-v2), and lets me search them with natural language. Show top 3 matches with cosine similarity scores.",
        successCriteria: "You can ask 'documents about pricing' and get the right files even if 'pricing' isn't in them.",
      }),
    ]),
    level(T, 7, "Tokens and context", "The unit AI thinks in.", 4, [
      spark("Tokens are slices", {
        type: "microread",
        title: "Tokens, not words",
        body: "AI doesn't see 'unbelievable' as one word — it sees ['un', 'believ', 'able'] or similar chunks called tokens. A token averages ~4 characters in English. Why care? Because pricing, context windows, and latency are all token-based. A 200,000-token context isn't 200,000 words — it's roughly 150,000 words. Fitting your knowledge base in context vs. retrieving slices via RAG is one of the central design choices of any AI product.",
        takeaway: "Think in tokens, not words. Cost and capacity live there.",
        bodyByAgeBand: {
          kid: "AI doesn't read whole words — it reads chunks called tokens. The word 'unbelievable' might split into 'un', 'believ', 'able' — three tokens. A token is about 4 letters on average. Why does it matter? Because everything an AI does is counted in tokens: how much it can read at once, how fast it answers, how much it costs to use. So when grown-ups talk about a '200,000 token window', that's not 200,000 words — it's about 150,000.",
          teen: "AI doesn't see whole words — it sees tokens, which are little chunks of text. 'Unbelievable' splits into 'un', 'believ', 'able' — three tokens. One token is roughly 4 characters in English. This matters because everything is measured in tokens: how much the model can read in one go (its context window), how fast it answers, how much it costs to run. A 200,000-token context window is closer to 150,000 words than 200,000 — and that gap shapes how AI tools are built.",
        },
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Estimate", {
        type: "quickpick",
        prompt: "Roughly how many tokens is a typical English page (~500 words)?",
        options: ["~50", "~250", "~650", "~5,000"],
        answer: 2,
        explain: "1 word ≈ 1.3 tokens in English. So 500 words ≈ 650 tokens.",
      }),
    ]),
    level(T, 8, "How models 'reason'", "It's prediction, but staged.", 5, [
      spark("Chain of thought", {
        type: "microread",
        title: "Reasoning is just longer prediction",
        body: "When a model 'reasons', it's not thinking — it's predicting more tokens before committing to an answer. Asking it to 'think step by step' gives it room to lay out scratch work, which dramatically improves accuracy on math, logic, and multi-hop questions. Newer reasoning models (like o-series, Claude with thinking) bake this in: they generate hidden thinking tokens automatically. Same engine, more deliberation.",
        takeaway: "Reasoning = giving the model room to lay out steps before answering.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "On a hard task, just append: 'Think step by step. Show your work.' Free 5-15% accuracy boost on most non-trivial prompts.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Scenario", {
        type: "scenario",
        setup: "Your model gets 70% on a multi-step math benchmark.",
        prompt: "Cheapest way to push it past 80%?",
        options: [
          "Train your own foundation model",
          "Add 'think step by step' and let it expand reasoning",
          "Switch hosting providers",
          "Lower temperature to 0",
        ],
        answer: 1,
        explain: "Prompting for reasoning is the cheapest, fastest accuracy lever you have.",
      }),
    ]),
    level(T, 9, "Evals: the only ground truth", "Without evals you're flying blind.", 5, [
      spark("Vibes don't ship", {
        type: "microread",
        title: "Evals beat vibes",
        body: "Every team eventually learns the same lesson: 'looks great in demo' ≠ 'works in prod'. Evals are repeatable test sets you score your system against, ideally tied to real user outcomes. Start with 20 hand-crafted hard cases. Score every prompt change against them. When you can't tell whether a change is better, your eval set is too small or too easy. Evals are unsexy. They're also the difference between a toy and a product.",
        takeaway: "Evals are the unit tests of AI. No evals, no progress.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "What's the best first eval set for a new AI feature?",
        options: [
          "1,000 random examples",
          "20 hand-picked tricky cases",
          "Whatever the model output last week",
          "User reviews from the app store",
        ],
        answer: 1,
        explain: "Small, sharp, hand-picked beats big and noisy. Iterate from there.",
      }),
    ]),
    level(T, 10, "Boss: foundations check", "Prove you've internalized it.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: AI Foundations",
        questions: [
          {
            type: "quickpick",
            prompt: "A model 'hallucinates'. Most likely cause?",
            options: ["GPU error", "Gaps or noise in training data", "Cosmic rays", "Bad internet"],
            answer: 1,
            explain: "The model fills gaps with plausible patterns. Gaps come from data.",
          },
          {
            type: "quickpick",
            prompt: "You want fast, cheap classification. Best choice?",
            options: ["Big generative LLM", "Small fine-tuned classifier", "Image generator", "Diffusion model"],
            answer: 1,
            explain: "Right tool for the job. Generative is overkill for picking labels.",
          },
          {
            type: "quickpick",
            prompt: "Which lever has the biggest accuracy ROI early on?",
            options: ["Bigger model", "Cleaner data + better evals", "More GPUs", "Lower temperature"],
            answer: 1,
            explain: "Always. Data and evals first.",
          },
        ],
      }),
    ]),
  ],
};
