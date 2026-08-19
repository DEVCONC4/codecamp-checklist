// The whole camp lives here. Changing the camp means editing this file and
// nothing else. Content is audited against the Barangay AI repo (context/):
// where the app and this file disagree, the app wins.
//
// Step bodies mark up DO and READ differently, so a participant can find the
// next thing they have to type without re-reading the prose:
//
//   <ol class="acts"><li>…   an action, numbered and in order
//   <div class="lesson">…    explanation — why it works, what to look at
//   <div class="callout">…   an aside or a gotcha
//   <p class="cmdlabel">…    which machine the command block below it is for
//
// Nothing outside .acts is an instruction. Worth keeping to as steps are added.
//
// Proof types: text | longtext | choice (needs options) | screenshot.
// Optionality is DERIVED, never declared — a step with no required proof is
// automatically optional and drops out of the completion gate. Strip the last
// required proof from a step and it silently stops counting.

export const CAMP = {
  title: 'Barangay AI Code Camp',
  code: 'AISB-2026',
  modules: [
    {
      id: 'm0',
      title: 'Before the camp — set up your machine',
      steps: [
        {
          id: 'p1',
          title: 'Install Ollama and pull your model',
          minutes: 20,
          body: `
            <p>Ollama is the free app that runs the AI on your own computer — no cloud, no API fees, nothing leaving the room. Download it from <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com/download</a>, then pull a model.</p>
            <div class="codeblock"><pre>ollama pull qwen2.5:3b
ollama list</pre><button class="copy" data-copy="ollama pull qwen2.5:3b
ollama list">Copy</button></div>
            <p><code>qwen2.5:3b</code> is about 2 GB and a safe default. If you already read <strong>Models 101</strong>, pull the one that fits your machine instead — you'll justify your pick in Hour 1.</p>
            <div class="callout">Do this at home, on home wifi. Downloads are the single biggest time sink on camp day.</div>`,
          proofs: [
            { key: 'os', type: 'choice', label: 'Which operating system are you on?', options: ['Windows', 'macOS', 'Linux'], required: true },
            { key: 'model', type: 'text', label: 'Which model did you pull?', hint: 'Exactly as it appears in ollama list, e.g. qwen2.5:3b', required: true },
            { key: 'shot', type: 'screenshot', label: 'Your terminal showing ollama list', required: true },
          ],
          mentorNote: 'Bring the models on USB sticks. Venue wifi will not survive 30 people pulling a 2 GB model at once — Ollama stores them in ~/.ollama/models and copying that folder works. Decide the room’s default model in advance and say it out loud: qwen2.5:1.5b or gemma3:1b for low-spec school machines, qwen2.5:3b if you know the hardware is decent.',
        },
        {
          id: 'p2',
          title: 'Let the browser talk to Ollama',
          minutes: 5,
          body: `
            <p>By default Ollama refuses requests coming from a web page. Skip this and the app will load fine but every message fails with a CORS error. Run it <strong>once</strong>, then quit Ollama and reopen it — the permission sticks from then on.</p>
            <p class="eyebrow" style="display:block;margin-bottom:6px">Windows · PowerShell</p>
            <div class="codeblock"><pre>[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS","*","User")</pre><button class="copy" data-copy="[Environment]::SetEnvironmentVariable(&quot;OLLAMA_ORIGINS&quot;,&quot;*&quot;,&quot;User&quot;)">Copy</button></div>
            <p class="eyebrow" style="display:block;margin-bottom:6px">macOS / Linux</p>
            <div class="codeblock"><pre>echo 'export OLLAMA_ORIGINS="*"' &gt;&gt; ~/.zshrc</pre><button class="copy" data-copy="echo 'export OLLAMA_ORIGINS=&quot;*&quot;' >> ~/.zshrc">Copy</button></div>
            <div class="callout"><code>*</code> means any page you visit can reach your local Ollama while it's running. That's the right trade for a camp laptop. To be strict, set the exact origin instead — <code>http://localhost:8000</code>.</div>
            <p>Skipping this is survivable — Hour 2 has a script that handles it each time. Doing it now just means you never think about it again.</p>`,
          proofs: [
            { key: 'restarted', type: 'choice', label: 'Did you quit and reopen Ollama afterwards?', options: ['Yes, restarted it', 'Not yet', "I'll use the Hour 2 script instead"], required: true },
          ],
          mentorNote: 'This is the single most common setup dead-end at camps. The failure mode is nasty because Ollama looks like it’s running fine. Watch for bash syntax typed into PowerShell — OLLAMA_ORIGINS=* ollama serve does nothing on Windows and fails almost silently.',
        },
        {
          id: 'p3',
          title: 'Tools and accounts',
          minutes: 20,
          body: `
            <p>Five things, all free. Get them out of the way before the room starts.</p>
            <ul>
              <li><strong>VS Code</strong> to edit the files — <a href="https://code.visualstudio.com" target="_blank" rel="noopener">code.visualstudio.com</a></li>
              <li><strong>Git</strong> to upload your code — <a href="https://git-scm.com/downloads" target="_blank" rel="noopener">git-scm.com/downloads</a></li>
              <li><strong>GitHub account</strong>, where your code lives — <a href="https://github.com/signup" target="_blank" rel="noopener">github.com/signup</a></li>
              <li><strong>Vercel account</strong>, which puts your AI online. <strong>Sign in with GitHub</strong> so the two connect — <a href="https://vercel.com/signup" target="_blank" rel="noopener">vercel.com/signup</a></li>
              <li><strong>Chrome or Edge</strong> as your browser</li>
            </ul>
            <p>You also need a way to serve the folder over a local web server. Check what you already have:</p>
            <div class="codeblock"><pre>git --version
python --version</pre><button class="copy" data-copy="git --version
python --version">Copy</button></div>
            <p>No Python? Use <code>npx serve .</code> if you have Node, or add the <strong>Live Server</strong> extension in VS Code and right-click <code>index.html</code> → <em>Open with Live Server</em>. Any one of the three is enough.</p>`,
          proofs: [
            { key: 'gh', type: 'text', label: 'Your GitHub username', hint: 'Just the username — this is where your fork lives', required: true },
            { key: 'serve', type: 'choice', label: 'How will you serve the folder?', options: ['python -m http.server', 'npx serve .', 'VS Code Live Server'], required: true },
            { key: 'vercel', type: 'choice', label: 'Vercel account, signed in with GitHub?', options: ['Done', 'Signed up with email instead', 'Not yet'], required: true },
            { key: 'shot', type: 'screenshot', label: 'Terminal showing your git and python versions', required: true },
          ],
          mentorNote: 'Vercel and Groq signups eat Hour 4 if they aren’t pre-done — this is where you buy that time back. Anyone who signed up to Vercel with email rather than GitHub will hit friction at import; have them link the account now, not at 3pm.',
        },
      ],
    },
    {
      id: 'm1',
      title: 'Hour 1 — Understand & fork',
      steps: [
        {
          id: 'h1a',
          title: 'Learn to read a model name',
          minutes: 20,
          body: `
            <p>Model names look scary, but each part tells you exactly one thing. Read it left to right:</p>
            <div class="codeblock"><pre>qwen2.5 : 3b - instruct - q4_K_M</pre><button class="copy" data-copy="qwen2.5:3b-instruct-q4_K_M">Copy</button></div>
            <ul>
              <li><code>qwen2.5</code> — <strong>family &amp; version.</strong> Who made it and which release.</li>
              <li><code>3b</code> — <strong>size.</strong> Billions of parameters. More knobs, more knowledge, bigger download, slower replies. 1B–3B runs on almost any laptop; 7B–8B needs about 8 GB RAM; 13B and up wants a real GPU.</li>
              <li><code>instruct</code> — <strong>flavor.</strong> Trained to follow instructions and chat. This is the one you want. <em>base</em> only continues text, it doesn't answer.</li>
              <li><code>q4_K_M</code> — <strong>quantization.</strong> How compressed the file is, roughly bits per knob. Q4 is the sweet spot. The K_M / K_S letters are just compression recipes.</li>
            </ul>
            <p>Rule of thumb: pick the <strong>biggest model that still feels fast</strong> on your computer. Browse <a href="https://ollama.com/library" target="_blank" rel="noopener">ollama.com/library</a> and choose. A safe formula is <code>1B–3B · instruct · Q4</code>.</p>
            <div class="callout">The app can choose for you. Onboarding Step 2 has a spec checker — tell it your RAM and GPU and it sorts every model into <em>Best for your PC</em> / <em>Will run, but slower</em> / <em>Not recommended</em>, and downloads it through Ollama with progress in the app. No terminal needed.</div>`,
          proofs: [
            { key: 'size', type: 'choice', label: 'What size band did you land on?', options: ['1B–3B', '7B–8B', '13B or larger'], required: true },
            { key: 'why', type: 'longtext', label: 'Why that model for your machine?', hint: 'Mention your RAM and whether you have a dedicated GPU — this is the part that proves you can read a model name, not just copy one', required: true },
          ],
          mentorNote: 'The fork is fast; the concepts are what fills this hour. Don’t rush the glossary — it’s the difference between following instructions and understanding them. If someone can explain why they picked Q4 over Q8, this step worked.',
        },
        {
          id: 'h1b',
          title: 'Fork the project on GitHub',
          minutes: 10,
          body: `
            <p>A fork is your own copy of someone else's code — like photocopying a recipe so you can add your own twist. Open the repo and click <strong>Fork</strong> at the top right.</p>
            <p>→ <a href="https://github.com/Spod101/barangayAI" target="_blank" rel="noopener">github.com/Spod101/barangayAI</a></p>
            <p><strong>On the fork screen, change the repository name to <code>&lt;surname&gt;_barangayAI</code></strong> before you click the green button. So if your surname is Dela Cruz, the name is <code>delacruz_barangayAI</code> — lowercase, no spaces.</p>
            <p>Repository name is the box right under <em>Owner</em>; GitHub fills it with <code>barangayAI</code>, so type over it. Everything else on that screen stays as it is.</p>
            <p>Your fork then lives at <code>github.com/&lt;your-username&gt;/&lt;surname&gt;_barangayAI</code>. That's the copy you're allowed to push to, and the one you'll deploy from in Hour 4. Keep the name — the rest of the day's commands assume it, and it's how the facilitators find your repo in a room of thirty identical ones.</p>`,
          proofs: [
            { key: 'forkurl', type: 'text', label: "Your fork's URL", hint: 'Should have your username in it, not Spod101, and end in <surname>_barangayAI', required: true },
          ],
          mentorNote: 'Two things to catch here, both cheap now and expensive later. People who skip the fork and clone the original: everything works until git push in Hour 4, then permission denied under time pressure. And people who forget to rename — the fork screen defaults to barangayAI, so the rename is easy to click past. Renaming after the fact is fine (Settings → General → Repository name), but their clone folder and remote are then wrong too.',
        },
        {
          id: 'h1c',
          title: 'Get the code on your computer',
          minutes: 15,
          body: `
            <p>Clone your fork — use <strong>your own</strong> username and <strong>your own</strong> repo name from the last step, not Spod101's.</p>
            <div class="codeblock"><pre>git clone https://github.com/&lt;your-username&gt;/&lt;surname&gt;_barangayAI.git
cd &lt;surname&gt;_barangayAI</pre><button class="copy" data-copy="git clone https://github.com/<your-username>/<surname>_barangayAI.git
cd <surname>_barangayAI">Copy</button></div>
            <p>Both angle-bracket bits are placeholders — replace them, brackets and all. Easiest way to get it right: open your fork on GitHub, click the green <strong>Code</strong> button and copy the URL it gives you.</p>
            <p>Then open that folder in VS Code — <strong>File → Open Folder</strong>, pick <code>&lt;surname&gt;_barangayAI</code>. The folder name shows at the top of the sidebar; that's what the screenshot below wants.</p>
            <p>Just reading along and not forking? Clone the original instead — but you won't be able to push your changes later.</p>`,
          proofs: [
            { key: 'how', type: 'choice', label: 'How did you get the code?', options: ['git clone', 'Downloaded the ZIP'], required: true },
            { key: 'shot', type: 'screenshot', label: 'The project open in VS Code, folder name visible', hint: 'The folder in the sidebar should read <surname>_barangayAI — that one frame shows the clone worked and that you cloned your own fork', required: true },
          ],
          mentorNote: 'Downloading the ZIP works but strips git history and the push path, so they’d have to set up the remote by hand in Hour 4. Steer everyone to clone unless Git is genuinely broken on their machine. The screenshot is the cheap check on the previous step too: a sidebar reading plain barangayAI means they cloned the original, or forked without renaming, and both are far cheaper to fix now than at git push in Hour 4.',
        },
      ],
    },
    {
      id: 'm2',
      title: 'Hour 2 — Run it locally',
      steps: [
        {
          id: 'h2a',
          title: 'Start Ollama the right way',
          minutes: 15,
          body: `
            <p>Open a terminal <strong>in the project folder</strong>. Whichever way you go below, it does the same two things: clears anything stuck on the port, then starts the server with browser access enabled. <strong>Leave that terminal open.</strong></p>
            <p>Three ways to do it — pick <em>one</em>, then tell the proof box which one you picked.</p>

            <h4 class="opthead"><span class="tag">Way 1</span>The bundled script</h4>
            <p>Already sitting in the project you cloned. Recommended — it handles the port and the permission for you. <strong>Run only the block for your machine.</strong></p>
            <p class="cmdlabel">Windows <span class="note">the leading .\\ is required</span></p>
            <div class="codeblock"><pre>.\\start-ollama.cmd</pre><button class="copy" data-copy=".\\start-ollama.cmd">Copy</button></div>
            <p class="cmdlabel">macOS / Linux <span class="note">the chmod line is only needed the first time</span></p>
            <div class="codeblock"><pre>chmod +x start-ollama.sh
./start-ollama.sh</pre><button class="copy" data-copy="chmod +x start-ollama.sh
./start-ollama.sh">Copy</button></div>

            <h4 class="opthead"><span class="tag">Way 2</span>The one-liner</h4>
            <p>Prefer typing it yourself? Same two things, one line. The two versions are <strong>not</strong> interchangeable — they're different languages, not different spellings of the same command.</p>
            <p class="cmdlabel">Windows <span class="note">PowerShell</span></p>
            <div class="codeblock"><pre>Stop-Process -Name "ollama*" -Force -ErrorAction SilentlyContinue; $env:OLLAMA_ORIGINS="*"; ollama serve</pre><button class="copy" data-copy="Stop-Process -Name &quot;ollama*&quot; -Force -ErrorAction SilentlyContinue; $env:OLLAMA_ORIGINS=&quot;*&quot;; ollama serve">Copy</button></div>
            <p class="cmdlabel">macOS / Linux <span class="note">bash or zsh</span></p>
            <div class="codeblock"><pre>pkill -f ollama; OLLAMA_ORIGINS=* ollama serve</pre><button class="copy" data-copy="pkill -f ollama; OLLAMA_ORIGINS=* ollama serve">Copy</button></div>
            <div class="callout"><strong>Windows gotcha:</strong> <code>OLLAMA_ORIGINS=* ollama serve</code> is the macOS / Linux line. PowerShell doesn't understand it and fails silently-ish. On Windows you want <code>$env:OLLAMA_ORIGINS="*"</code>. This is the most common dead-end of the day.</div>

            <h4 class="opthead"><span class="tag">Way 3</span>Just opened the Ollama app</h4>
            <p>Did the pre-install step already? Then opening the normal Ollama app from the tray or menu bar is enough — the permission stuck. No terminal needed.</p>`,
          proofs: [
            { key: 'how', type: 'choice', label: 'How did you start it?', hint: 'Way 1, 2 or 3 above — the answers here use the same wording as the headings', options: ['The bundled script', 'The one-liner', 'Just opened the Ollama app'], required: true },
            { key: 'shot', type: 'screenshot', label: 'Terminal with the server running', required: true },
          ],
          mentorNote: 'Roughly all camp-day blockers are one of four things: OLLAMA_ORIGINS not set, a stale background Ollama holding port 11434, bash syntax typed into PowerShell, or index.html opened by double-click. Keep the troubleshooting section on the projector. ‘Port already in use’ always means kill it first — Stop-Process -Name ‘ollama*’ -Force on Windows, pkill -f ollama elsewhere. The commands are split by machine now, so the fastest triage question is ‘which way did you start it, and what did the label above the block say?’ — a Windows user who ran the macOS line is the most common answer.',
        },
        {
          id: 'h2b',
          title: 'Talk to it in the terminal',
          minutes: 10,
          body: `
            <p>In a <strong>second</strong> window, run your model and say something. Type <code>/bye</code> to exit. Use your own model name.</p>
            <div class="codeblock"><pre>ollama run qwen2.5:3b</pre><button class="copy" data-copy="ollama run qwen2.5:3b">Copy</button></div>
            <p>This is the AI running entirely on your machine. No internet, no account, no per-token fee. Pull your wifi out and it still answers.</p>`,
          proofs: [
            { key: 'asked', type: 'text', label: 'What did you ask it?', required: true },
            { key: 'replied', type: 'longtext', label: 'What did it answer?', hint: 'Paste or retype the reply — a couple of sentences is plenty. This is the line that proves a model on your own machine actually spoke back', required: true },
          ],
          mentorNote: 'This step exists to split the debugging surface. If the terminal works and the browser doesn’t, it’s CORS or the web server — never the model. Point that out loud; it saves you an hour of misdiagnosis across the room.',
        },
        {
          id: 'h2c',
          title: 'Serve the app and send your first message',
          minutes: 20,
          body: `
            <p>Your first two terminals are busy — one running the server, one running the chat. This is a <strong>third</strong> one, and it opens wherever your computer feels like, so the first thing to do is walk it to the project folder.</p>

            <ol class="acts">
              <li>
                <p>Open a third terminal and go to the project folder.</p>
                <p class="cmdlabel">Any machine <span class="note">same command on Windows, macOS and Linux</span></p>
                <div class="codeblock"><pre>cd &lt;surname&gt;_barangayAI</pre><button class="copy" data-copy="cd <surname>_barangayAI">Copy</button></div>
                <div class="lesson">
                  <span class="tag">Why</span>
                  <p>A new terminal starts in your home folder, not in your project. <code>python -m http.server</code> serves <em>whatever folder you are standing in</em> — run it from the wrong place and you get a file listing of your Documents instead of the app, with no error to tell you why.</p>
                  <p>Not sure you're in the right place? <code>dir</code> on Windows or <code>ls</code> on macOS / Linux should list <code>index.html</code>. If it doesn't, you're not there yet. Shortcut: in VS Code, <strong>Terminal → New Terminal</strong> opens already inside the project, and you can skip the <code>cd</code>.</p>
                </div>
              </li>

              <li>
                <p>Start the web server. Leave this terminal open too.</p>
                <p class="cmdlabel">Windows</p>
                <div class="codeblock"><pre>python -m http.server 8000</pre><button class="copy" data-copy="python -m http.server 8000">Copy</button></div>
                <p class="cmdlabel">macOS / Linux <span class="note">python3, not python</span></p>
                <div class="codeblock"><pre>python3 -m http.server 8000</pre><button class="copy" data-copy="python3 -m http.server 8000">Copy</button></div>
                <div class="lesson">
                  <span class="tag">No Python?</span>
                  <p>Whichever you told us in the pre-install step works here: <code>npx serve .</code> if you have Node, or right-click <code>index.html</code> in VS Code → <em>Open with Live Server</em>. Both of those pick their own port and will tell you which — use that number in the next action instead of 8000.</p>
                </div>
              </li>

              <li>
                <p>Open <strong>http://localhost:8000</strong> in Chrome or Edge.</p>
                <div class="lesson">
                  <span class="tag">Not by double-clicking</span>
                  <p>Do <strong>not</strong> double-click <code>index.html</code>. That opens it as <code>file://</code>, and the browser blocks parts of the app — you get a blank page or scripts that never load, and nothing says why. It has to be <code>localhost</code>.</p>
                </div>
              </li>

              <li>
                <p>Fill in the three-step welcome wizard that opens.</p>
                <div class="lesson">
                  <span class="tag">What it's asking</span>
                  <p>Step 2, <strong>Pick a model</strong>, has a spec checker — tell it your RAM and graphics card and it sorts every model into what your machine can handle, and downloads one for you if you skipped the terminal.</p>
                  <p>Step 3 asks for two names: what your AI is called, and <strong>your own name</strong>, which is what gets credited as the builder when you publish. Both are required before it lets you into the chat. You'll refine all of it in Hour 3.</p>
                </div>
                <div class="callout">The wizard reopens on every reload. That's normal, not a bug — close it and carry on. The book icon next to the gear opens the <strong>Camp Guidebook</strong>: these same steps, inside the app.</div>
              </li>

              <li>
                <p>Check the status chip at the top right is <strong>green</strong> before going on.</p>
                <div class="lesson">
                  <span class="tag">Reading the chip</span>
                  <p>Green means your model is reachable, and it names the model once you've picked one — until then it just reads <strong>Ollama</strong>. Red, or <em>Offline</em>, means the browser still can't reach Ollama: go back to the previous step, don't carry on here.</p>
                  <p>While you're looking around: <strong>Sources</strong> in the sidebar already has a document loaded — reference material your AI can quote from on day one.</p>
                </div>
              </li>

              <li>
                <p>Pick your model in the model picker, type <strong>"Kumusta!"</strong>, and watch it reply word by word.</p>
                <div class="callout">Nothing is selected by default — you have to choose a model after the app discovers what Ollama has. That's deliberate.</div>
              </li>
            </ol>`,
          proofs: [
            { key: 'selected', type: 'text', label: 'Which model did you select in the app?', required: true },
            { key: 'shot', type: 'screenshot', label: 'The app replying, with the green status chip visible', required: true },
          ],
          mentorNote: 'Add ‘which folder is that terminal in?’ to the triage list — a third terminal opens at home, and a server started from the wrong folder shows a file listing rather than an error, so it reads as a broken app. Blank page or scripts not loading means they opened it via file:// — serve it properly. ‘No models found’ means either Ollama isn’t running or the wrong instance is; have them open http://localhost:11434/v1/models directly in the browser, which answers both questions at once. Expect ‘the setup box keeps coming back’ — the welcome wizard opens on every reload by design. Say it once to the room and you won’t answer it thirty times.',
        },
        {
          id: 'h2d',
          title: 'Optional — connect a cloud model',
          minutes: 10,
          body: `
            <p>Only if you want a second option, or your machine can't run a local model comfortably. Open the model picker at the bottom of the chat and click <strong>Add Models</strong>.</p>
            <p>The dialog has a <strong>LOCAL</strong> card for Ollama and an <strong>API</strong> card for a cloud provider. Any OpenAI-compatible endpoint works, which is why one dialog fits them all. Pick a provider — DeepSeek, OpenAI, Together, Groq, or Custom — and the endpoint URL auto-fills. Paste your key, click <strong>Test</strong>, then <strong>Add</strong>.</p>
            <div class="callout">Anything you add here is saved <strong>in this browser only</strong>. It makes your copy work, not your published one — the live site gets its model from a Vercel environment variable in Hour 4.</div>`,
          proofs: [
            { key: 'provider', type: 'choice', label: 'Did you add one?', options: ['Groq', 'DeepSeek', 'OpenAI', 'Together', 'Custom endpoint', 'Skipped — local is enough'], required: false },
          ],
          mentorNote: 'This is the fallback for machines that can’t run anything locally — small models still fail on the very oldest hardware. The other fallback is pairing them with a neighbor. Either way, name the trade out loud: they finish the build but miss the local-first point, and can run it locally later.',
        },
      ],
    },
    {
      id: 'm3',
      title: 'Hour 3 — Customize',
      steps: [
        {
          id: 'h3a',
          title: 'Name it and shape its personality',
          minutes: 20,
          body: `
            <p>Click the gear icon at the top right. Everything updates the live preview as you type — no code.</p>
            <p><strong>Settle on the name.</strong> You gave it one at first launch to get into the chat — this is where you change your mind. Bayani, Isko, Barangay AI, anything. It shows in the header, welcome screen, and avatars. Your own name is here too, and that's the one credited as the builder when you publish, so check it reads the way you want to be credited.</p>
            <p><strong>Shape its personality.</strong> Write how it behaves: friendly tutor, barangay helper, coding buddy. This is its <strong>system prompt</strong> — a hidden instruction given before the conversation starts, like a job description on someone's first day. There are presets and an AI-assisted expander if you want help writing one.</p>`,
          proofs: [
            { key: 'ainame', type: 'text', label: 'What did you name your AI?', required: true },
            { key: 'prompt', type: 'longtext', label: 'Paste your system prompt', hint: "The actual text you wrote — this is the most interesting thing you'll make today", required: true },
            { key: 'shot', type: 'screenshot', label: 'Your AI, named and answering in character', required: true },
          ],
          mentorNote: 'This is the fun hour. Let it run long if the room is engaged — customization is where people take ownership. The system prompts are also the best material for the closing demo, so keep an eye out for good ones.',
        },
        {
          id: 'h3b',
          title: 'Language, colour and greeting',
          minutes: 10,
          body: `
            <p>Set the reply language — it answers in your chosen language no matter what you type in. Then set a brand colour, a welcome message, and the suggestion chips.</p>
            <p>Hit <strong>Save</strong>. The whole app updates instantly, and this is exactly what your visitors will see.</p>`,
          proofs: [
            { key: 'lang', type: 'choice', label: 'Reply language', options: ['English', 'Filipino (Tagalog)', 'Taglish', 'Bisaya', 'Hiligaynon', 'Ilocano'], required: true },
          ],
          mentorNote: 'Worth demoing on the projector: type in English, get Bisaya back. It lands harder than any slide about what a system prompt is.',
        },
        {
          id: 'h3c',
          title: 'Teach it your own documents',
          minutes: 25,
          body: `
            <p>Open <strong>Sources</strong> in the sidebar. Drop in your own <code>.txt</code>, <code>.md</code>, <code>.json</code>, <code>.csv</code>, <code>.log</code>, <code>.pdf</code> or <code>.docx</code> — up to <strong>2 MB each</strong>, anything bigger is skipped — then ask a question only that file could answer.</p>
            <p>The app doesn't stuff the whole file into every message. It pulls just the passages that match your question, which is why a long document still works on a small model.</p>
            <div class="callout"><strong>Nothing is being trained.</strong> Your files are chunked, and the chunks most relevant to each question are retrieved and pasted into the prompt. That's <strong>RAG</strong> — retrieval-augmented generation. The model is <em>grounded</em> on your documents, not trained on them.</div>
            <p>Open the <strong>Sources</strong> panel under any answer to see exactly which chunk of which file it used, the similarity score that earned it a place, and the literal prompt that was sent to the model. The proof boxes below ask for your question, the reply, and that chunk and score separately — the last one is the only thing that proves the answer came from your file.</p>`,
          proofs: [
            { key: 'file', type: 'text', label: 'What document did you add?', hint: "Name and roughly what's in it", required: true },
            { key: 'asked', type: 'text', label: 'What did you ask it?', hint: 'Pick something only your file could answer — a name, a number, a date that is in no model anywhere', required: true },
            { key: 'replied', type: 'longtext', label: 'What did it answer?', hint: 'Paste the reply. Was it actually right?', required: true },
            { key: 'chunk', type: 'longtext', label: 'Which chunk did it pull, and what was the match score?', hint: 'Open the Sources panel underneath the answer — it names the file, shows the passage it retrieved, and gives that passage a similarity score. This is the part that shows the answer came from your document and not from the model', required: true },
            { key: 'shot', type: 'screenshot', label: 'Your question and its answer on screen', hint: 'Expand the Sources panel under the answer before you capture, so the question, the reply, the chunk and the match score are all in one frame', required: true },
          ],
          mentorNote: 'If anyone says ‘it’s now trained on my file’, correct it there and then — grounded, not trained. Opening the Sources panel to show the retrieved chunk and its similarity score is the single best teaching moment in the camp. The chunk-and-score box is its own required field now, so a blank or hand-waved one is easy to spot on the desk. The screenshot is the faster check of the two: Sources collapsed in the frame means they never opened it, whatever the text box says.',
        },
      ],
    },
    {
      id: 'm4',
      title: 'Hour 4 — Publish',
      steps: [
        {
          id: 'h4a',
          title: 'Publish your AI and push',
          minutes: 15,
          body: `
            <p>Finish customizing first — that's the version the world will see.</p>
            <p>Everything you set up lives in <em>this browser</em>, which is why it's private, and why pushing your code alone would deploy the blank starter app instead of yours. Go to <strong>Settings → Publish → Download <code>my-ai.json</code></strong>, then drop that file into your project folder, beside <code>index.html</code>.</p>
            <p>Before you push, hit <strong>Preview what visitors will see</strong> on that same Publish screen. It shows your AI exactly as a stranger gets it. If your name, personality or sources are missing there, they'll be missing on the live site too — cheaper to find out now than after a deploy.</p>
            <div class="codeblock"><pre>git add .
git commit -m "Publish my AI"
git push</pre><button class="copy" data-copy="git add .
git commit -m &quot;Publish my AI&quot;
git push">Copy</button></div>`,
          proofs: [
            { key: 'repo', type: 'text', label: 'Your repo URL', required: true },
            { key: 'shot', type: 'screenshot', label: 'A successful push, with my-ai.json in the commit', required: true },
          ],
          mentorNote: '‘The published site works but my customization is missing’ always means they pushed without my-ai.json. Check the screenshot for my-ai.json in the commit — catching it here beats debugging a live deploy.',
        },
        {
          id: 'h4b',
          title: 'Deploy to Vercel and add your key',
          minutes: 25,
          body: `
            <p>On Vercel: <strong>Add New → Project</strong>, pick your repo, click <strong>Deploy</strong>. No config needed.</p>
            <p>Visitors can't reach the Ollama on your laptop, so the live copy borrows a hosted model. Get a free key at <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a> — no card needed. Then on your project, go to <strong>Settings → Environment Variables</strong>, add <code>MODEL_API_KEY</code>, and <strong>Redeploy</strong>.</p>
            <ul>
              <li><code>MODEL_API_KEY</code> — <strong>required</strong></li>
              <li><code>MODEL_API_BASE</code> — optional, defaults to the Groq endpoint</li>
              <li><code>MODEL_NAME</code> — optional, defaults to <code>llama-3.1-8b-instant</code></li>
            </ul>
            <div class="callout"><strong>Never paste a key into a file you commit.</strong> Your repo is public, and keys in public repos get found and drained within hours. <code>my-ai.json</code> is written without any key by design. Use a free-tier or spend-capped key — the proxy caps reply length but has no per-IP rate limit yet, so a public link is a public endpoint backed by your quota.</div>`,
          proofs: [
            { key: 'liveurl', type: 'text', label: 'Your live URL', hint: 'Something like your-ai.vercel.app — open it on your phone before you submit', required: true },
            { key: 'keywhere', type: 'choice', label: 'Where is your API key stored?', options: ['In Vercel environment variables', 'In a file in my repo', "I haven't added one yet"], required: true },
            { key: 'shot', type: 'screenshot', label: 'Your live site in a browser, URL bar visible', required: true },
          ],
          mentorNote: 'Say the key warning out loud at least twice. If anyone answers ‘in a file in my repo’ on the comprehension check, go to them immediately — the key needs rotating, not just moving. If the room is behind on time, this is the step to protect: get everyone published and pushed, and let the deploy happen after the camp.',
        },
        {
          id: 'h4d',
          title: 'Wrap up',
          minutes: 10,
          body: `
            <div class="callout"><strong>Remember which one is the real one.</strong> The shared link runs on somebody else's computer, using a hosted model. The AI on <em>your</em> machine is the one that's free, offline, and private — nobody can meter it, price it, or switch it off. That's the one you actually built today.</div>
            <p>Tell us how the day went. This genuinely shapes the next camp, and these answers go to the facilitator rather than into your project write-up.</p>`,
          proofs: [
            { key: 'pace', type: 'choice', label: 'How was the pace?', options: ['Too slow', 'About right', 'Too fast'], required: true },
            { key: 'hardest', type: 'choice', label: 'Which hour was hardest?', options: ['Pre-install', 'Hour 1 — Fork', 'Hour 2 — Run it locally', 'Hour 3 — Customize', 'Hour 4 — Publish'], required: true },
            { key: 'feedback', type: 'longtext', label: 'Anything we should change?', hint: 'Optional, but read by a human', required: false },
          ],
          mentorNote: 'Collect the pace and hardest-hour ratings before people leave the room — response rate drops off a cliff once they’re out the door. The hardest-hour answers are your planning data for the next camp; expect Hour 2 to win and budget accordingly.',
        },
      ],
    },
  ],
};

// Flattened, with optionality derived rather than declared.
export const STEPS = CAMP.modules.flatMap((m) =>
  m.steps.map((s) => ({
    ...s,
    module: m.title,
    moduleId: m.id,
    optional: !s.proofs.some((p) => p.required),
  })),
);

export const REQ = STEPS.filter((s) => !s.optional);
export const TOTAL = REQ.length;

export const stepById = (id) => STEPS.find((s) => s.id === id);
export const stepNumber = (id) => {
  const i = REQ.findIndex((s) => s.id === id);
  return i < 0 ? '—' : String(i + 1).padStart(2, '0');
};

// Wrap-up is facilitator feedback, not portfolio material. It flows to the
// roster and the spreadsheet but never into the public write-up.
export const PRIVATE = ['h4d'];
