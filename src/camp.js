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
//   <details class="how">…   optional help behind an "i" — how to install X
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
            <details class="how"><summary><i>i</i>How to install Ollama</summary><div class="body">
              <p><strong>Windows</strong> — run the installer and let it finish. Ollama then sits in the system tray and starts with your machine.</p>
              <p><strong>macOS</strong> — unzip the download, drag <strong>Ollama</strong> into <strong>Applications</strong>, then open it once and allow it when macOS asks.</p>
              <p><strong>Linux</strong> — one line in a terminal:</p>
              <div class="codeblock"><pre>curl -fsSL https://ollama.com/install.sh | sh</pre><button class="copy" data-copy="curl -fsSL https://ollama.com/install.sh | sh">Copy</button></div>
              <p>Either way, <code>ollama --version</code> then prints a number. If the terminal says it doesn't know the command, close that window and open a new one — a fresh terminal is what notices a newly installed tool.</p>
            </div></details>
            <details class="how"><summary><i>i</i>How to open a terminal</summary><div class="body">
              <p><strong>Windows</strong> — press <span class="kbd">Win</span> <span class="kbd">X</span> and choose <strong>Terminal</strong>, or click Start and type <em>powershell</em>.</p>
              <p><strong>macOS</strong> — press <span class="kbd">Cmd</span> <span class="kbd">Space</span>, type <em>terminal</em>, press Enter.</p>
              <p>Or from inside VS Code: <strong>Terminal → New Terminal</strong>. That one has the useful habit of opening in whatever folder you already have open.</p>
            </div></details>
            <div class="codeblock"><pre>ollama pull qwen2.5:3b
ollama list</pre><button class="copy" data-copy="ollama pull qwen2.5:3b
ollama list">Copy</button></div>
            <p><code>qwen2.5:3b</code> is about 2 GB and a safe default. If you already read <strong>Models 101</strong>, pull the one that fits your machine instead — you'll justify your pick in Level 1.</p>
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
            <details class="how"><summary><i>i</i>How to check it worked</summary><div class="body">
              <p>Open a <em>new</em> terminal — the one you just used still holds the old settings — and print the value back:</p>
              <p class="cmdlabel">Windows <span class="note">PowerShell</span></p>
              <div class="codeblock"><pre>echo $env:OLLAMA_ORIGINS</pre><button class="copy" data-copy="echo $env:OLLAMA_ORIGINS">Copy</button></div>
              <p class="cmdlabel">macOS / Linux</p>
              <div class="codeblock"><pre>echo $OLLAMA_ORIGINS</pre><button class="copy" data-copy="echo $OLLAMA_ORIGINS">Copy</button></div>
              <p>A lone <code>*</code> means it stuck. A blank line means it didn't — run the command above again, in a terminal you opened yourself.</p>
            </div></details>
            <p>Skipping this is survivable — Level 2 has a script that handles it each time. Doing it now just means you never think about it again.</p>`,
          proofs: [
            { key: 'restarted', type: 'choice', label: 'Did you quit and reopen Ollama afterwards?', options: ['Yes, restarted it', 'Not yet', "I'll use the Level 2 script instead"], required: true },
          ],
          mentorNote: 'This is the single most common setup dead-end at camps. The failure mode is nasty because Ollama looks like it’s running fine. Watch for bash syntax typed into PowerShell — OLLAMA_ORIGINS=* ollama serve does nothing on Windows and fails almost silently.',
        },
        {
          id: 'p3',
          title: 'Tools and accounts',
          minutes: 20,
          body: `
            <p>Five things, all free. Get them out of the way before the room starts. Each one carries an <strong>i</strong> — open it if you have not done that particular thing before, ignore it if you have.</p>
            <ul>
              <li><strong>VS Code</strong> to edit the files — <a href="https://code.visualstudio.com" target="_blank" rel="noopener">code.visualstudio.com</a>
                <details class="how"><summary><i>i</i>How to install VS Code</summary><div class="body">
                  <p>The big download button on that page already matches your operating system, so take whatever it offers.</p>
                  <p><strong>Windows</strong> — run the <code>.exe</code> and accept the defaults. Leave <em>Add to PATH</em> ticked if it asks.</p>
                  <p><strong>macOS</strong> — unzip the download, then drag <strong>Visual Studio Code</strong> into your <strong>Applications</strong> folder before opening it. Opening it from the Downloads folder works today and confuses you tomorrow.</p>
                  <p>Open it once now, so the first time you use it is not in the room.</p>
                </div></details>
              </li>
              <li><strong>Git</strong> to upload your code — <a href="https://git-scm.com/downloads" target="_blank" rel="noopener">git-scm.com/downloads</a>
                <details class="how"><summary><i>i</i>How to install Git</summary><div class="body">
                  <p><strong>Windows</strong> — run the installer and accept every default screen. It also installs <strong>Git Bash</strong>; you won't need it, and leaving it costs nothing.</p>
                  <p><strong>macOS</strong> — the quickest route is one line in a terminal, which asks the system to install its developer tools:</p>
                  <div class="codeblock"><pre>xcode-select --install</pre><button class="copy" data-copy="xcode-select --install">Copy</button></div>
                  <p><strong>Linux</strong> — <code>sudo apt install git</code> on Debian or Ubuntu, or your distribution's equivalent.</p>
                  <p>Then check it landed. <code>git --version</code> should print a number. If the terminal says it doesn't know the command, close that window and open a new one — a fresh terminal is what notices a newly installed tool.</p>
                </div></details>
              </li>
              <li><strong>GitHub account</strong>, where your code lives — <a href="https://github.com/signup" target="_blank" rel="noopener">github.com/signup</a>
                <details class="how"><summary><i>i</i>How to create a GitHub account</summary><div class="body">
                  <p>Email, password, username, and the puzzle it gives you. Three things worth knowing while you pick:</p>
                  <p>Your username becomes part of every link you hand in — <code>github.com/&lt;username&gt;/…</code> — so choose something you would put on a CV.</p>
                  <p>Confirm the mail they send you before camp day. Some actions stay blocked on an unconfirmed account, and the block is easy to mistake for a broken button.</p>
                  <p>Keep the password somewhere you can reach in the room. You will sign in again with it, on Vercel.</p>
                </div></details>
              </li>
              <li><strong>Vercel account</strong>, which puts your AI online. <strong>Sign in with GitHub</strong> so the two connect — <a href="https://vercel.com/signup" target="_blank" rel="noopener">vercel.com/signup</a>
                <details class="how"><summary><i>i</i>How to connect Vercel to GitHub</summary><div class="body">
                  <p>This is the one worth doing carefully. The link between the two accounts is what lets Vercel see your fork later, and repairing it under time pressure is the most common Level 4 delay.</p>
                  <ol>
                    <li>Open <a href="https://vercel.com/signup" target="_blank" rel="noopener">vercel.com/signup</a> and choose the free <strong>Hobby</strong> plan.</li>
                    <li>Pick <strong>Continue with GitHub</strong> — not the email option. This is the whole point of the step.</li>
                    <li>GitHub asks whether Vercel may act on your behalf. Click <strong>Authorize Vercel</strong>.</li>
                    <li>Then it asks which repositories Vercel may see. <strong>All repositories</strong> is simplest for a camp; <em>Only select repositories</em> works too, as long as you remember to come back and add your fork.</li>
                    <li>You're done when the Vercel dashboard shows your GitHub avatar, and <strong>Add New → Project</strong> lists repositories you recognise.</li>
                  </ol>
                  <p><strong>Already signed up with an email address?</strong> You don't have to start over. In Vercel, open your account settings, find the connected-accounts section, and connect GitHub there — then authorise it on the GitHub screen exactly as above.</p>
                </div></details>
              </li>
              <li><strong>Chrome or Edge</strong> as your browser</li>
            </ul>

            <p>You also need a way to serve the folder over a local web server. There are three, you only need <strong>one</strong>, and the fastest way to choose is to find out what your machine already has:</p>
            <div class="codeblock"><pre>git --version
python --version
node --version</pre><button class="copy" data-copy="git --version
python --version
node --version">Copy</button></div>
            <p>Whichever of those printed a version number decides it for you. All three end up doing the same thing — putting the project folder on <code>http://localhost</code> so the browser will load it properly.</p>

            <h4 class="opthead"><span class="tag">Way 1</span>python -m http.server</h4>
            <p>Nothing to install, it comes with Python. Take this one if <code>python --version</code> printed a number.</p>
            <details class="how"><summary><i>i</i>What this looks like</summary><div class="body">
              <p>In Level 2 you'll open a terminal in the project folder and run one line, then leave that window open while you work:</p>
              <div class="codeblock"><pre>python -m http.server 8000</pre><button class="copy" data-copy="python -m http.server 8000">Copy</button></div>
              <p>It prints <em>Serving HTTP on …</em> and then looks like it has frozen. That is it working — the terminal is busy being the web server.</p>
              <p>On macOS and Linux the command is usually <code>python3</code>, not <code>python</code>. If plain <code>python</code> printed nothing there, try <code>python3 --version</code> before you rule this out.</p>
            </div></details>

            <h4 class="opthead"><span class="tag">Way 2</span>npx serve .</h4>
            <p>Comes with Node. Take this one if <code>node --version</code> printed a number and Python didn't.</p>
            <details class="how"><summary><i>i</i>What this looks like</summary><div class="body">
              <p>Same idea, different tool. In the project folder:</p>
              <div class="codeblock"><pre>npx serve .</pre><button class="copy" data-copy="npx serve .">Copy</button></div>
              <p>The first run asks permission to download the <code>serve</code> package — answer yes. It then prints the address it picked, which is usually <code>http://localhost:3000</code> rather than 8000. Use the number it prints, not the one in the instructions.</p>
              <p>No Node either? Install it from <a href="https://nodejs.org" target="_blank" rel="noopener">nodejs.org</a>, or take Way 3 and skip the terminal entirely.</p>
            </div></details>

            <h4 class="opthead"><span class="tag">Way 3</span>VS Code Live Server</h4>
            <p>An extension, and no terminal at all. Take this one if neither of the above printed anything, or if terminals make you nervous.</p>
            <details class="how"><summary><i>i</i>How to set it up</summary><div class="body">
              <ol>
                <li>Open VS Code and click <strong>Extensions</strong> in the left bar — the four-squares icon.</li>
                <li>Search <strong>Live Server</strong> and install the one by Ritwick Dey.</li>
                <li>In Level 2, open the project folder in VS Code, right-click <code>index.html</code> and choose <strong>Open with Live Server</strong>.</li>
              </ol>
              <p>It opens your browser for you, on a port it picks — usually <code>5500</code>. Use whatever number appears in the address bar.</p>
            </div></details>

            <div class="callout">Not sure which you have, or the check printed something you don't recognise? Pick the first one that gave you a version number and move on. Level 2 walks through whichever you chose, and the answer below is editable all day.</div>`,
          proofs: [
            { key: 'gh', type: 'text', label: 'Your GitHub username', hint: 'Just the username — this is where your fork lives', required: true },
            { key: 'serve', type: 'choice', label: 'Which of the three will you use?', hint: 'Whichever the version check printed a number for. Not sure yet? Pick the first one that answered — Level 2 walks through whichever you choose, and you can change this later', options: ['python -m http.server', 'npx serve .', 'VS Code Live Server'], required: true },
            { key: 'vercel', type: 'choice', label: 'Vercel account, signed in with GitHub?', options: ['Done', 'Signed up with email instead', 'Not yet'], required: true },
            { key: 'shot', type: 'screenshot', label: 'Terminal showing your git and python versions', required: true },
          ],
          mentorNote: 'Vercel and Groq signups eat Level 4 if they aren’t pre-done — this is where you buy that time back. Anyone who signed up to Vercel with email rather than GitHub will hit friction at import; have them link the account now, not at 3pm. The install walkthroughs are folded behind the i toggles, so a room that already has the tools sees a short step and a room that doesn’t has the click paths without you reading them out. Nobody has to admit to anything to open one.',
        },
      ],
    },
    {
      id: 'm1',
      title: 'Level 1 — Understand & fork',
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
          mentorNote: 'The fork is fast; the concepts are what fills this level. Don’t rush the glossary — it’s the difference between following instructions and understanding them. If someone can explain why they picked Q4 over Q8, this step worked.',
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
            <p>Your fork then lives at <code>github.com/&lt;your-username&gt;/&lt;surname&gt;_barangayAI</code>. That's the copy you're allowed to push to, and the one you'll deploy from in Level 4. Keep the name — the rest of the day's commands assume it, and it's how the facilitators find your repo in a room of thirty identical ones.</p>`,
          proofs: [
            { key: 'forkurl', type: 'text', label: "Your fork's URL", hint: 'Should have your username in it, not Spod101, and end in <surname>_barangayAI', required: true },
          ],
          mentorNote: 'Two things to catch here, both cheap now and expensive later. People who skip the fork and clone the original: everything works until git push in Level 4, then permission denied under time pressure. And people who forget to rename — the fork screen defaults to barangayAI, so the rename is easy to click past. Renaming after the fact is fine (Settings → General → Repository name), but their clone folder and remote are then wrong too.',
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
          mentorNote: 'Downloading the ZIP works but strips git history and the push path, so they’d have to set up the remote by hand in Level 4. Steer everyone to clone unless Git is genuinely broken on their machine. The screenshot is the cheap check on the previous step too: a sidebar reading plain barangayAI means they cloned the original, or forked without renaming, and both are far cheaper to fix now than at git push in Level 4.',
        },
      ],
    },
    {
      id: 'm2',
      title: 'Level 2 — Run it locally',
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
          title: 'Serve the app in your browser',
          minutes: 15,
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
                  <p>Step 3 asks for two names: what your AI is called, and <strong>your own name</strong>, which is what gets credited as the builder when you publish. Both are required before it lets you into the chat. You'll refine all of it in Level 3.</p>
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
            </ol>

            <div class="callout">Nothing is selected in the model picker by default — you have to tell the app where a model lives and then choose one. That's the next step, and it's deliberate.</div>`,
          proofs: [
            { key: 'shot', type: 'screenshot', label: 'The app open at localhost, with the status chip visible', required: true },
          ],
          mentorNote: 'Add ‘which folder is that terminal in?’ to the triage list — a third terminal opens at home, and a server started from the wrong folder shows a file listing rather than an error, so it reads as a broken app. Blank page or scripts not loading means they opened it via file:// — serve it properly. Expect ‘the setup box keeps coming back’ — the welcome wizard opens on every reload by design. Say it once to the room and you won’t answer it thirty times. The empty model picker is the next step, not a fault; hold that question until then.',
        },
        {
          id: 'h2d',
          title: 'Connect a model — local or cloud',
          minutes: 15,
          body: `
            <p>The picker is empty because the app doesn't guess. You tell it where a model lives, and one dialog takes both answers: <strong>Ollama on your own machine</strong>, or a <strong>cloud provider</strong> over the internet. Any OpenAI-compatible endpoint works, which is why one dialog fits them all.</p>
            <p>Open the model picker at the bottom of the chat and click <strong>Add Models</strong>. Everyone does the local card — free, offline, private, and the point of the camp. Do the API card as well only if you want a second option, or if your machine can't run a local model comfortably.</p>

            <ol class="acts">
              <li>
                <p>Read the two cards before typing anything.</p>
                <div class="lesson">
                  <span class="tag">Which card</span>
                  <p><strong>LOCAL</strong> is for Ollama on this machine. <strong>API</strong> is for a cloud provider, and needs a key. Both end up as an endpoint in the same list, and the chat treats them identically once they're added.</p>
                </div>
              </li>

              <li>
                <p>Paste your Ollama endpoint into the URL field on the LOCAL card, leave the key field empty, and click <strong>Add</strong>.</p>
                <div class="codeblock"><pre>http://localhost:11434/v1</pre><button class="copy" data-copy="http://localhost:11434/v1">Copy</button></div>
                <div class="lesson">
                  <span class="tag">The key field</span>
                  <p>The API key box on the LOCAL card is optional — it's there for protected local endpoints, which yours isn't. Leave it blank. The <strong>Quickstart</strong> panel inside that card repeats the Ollama commands from earlier in this level if you need them again, including <code>OLLAMA_ORIGINS=* ollama serve</code>.</p>
                </div>
              </li>

              <li>
                <p>Cloud only — on the API card, pick a provider from the dropdown: <strong>Groq</strong>, <strong>OpenAI</strong>, <strong>Together</strong>, <strong>DeepSeek</strong> or <strong>Custom</strong>. Choosing one auto-fills the endpoint URL for you. <strong>Groq</strong> is the camp default — free, and it's the same provider your published site uses in Level 4, so one key covers both.</p>
                <div class="codeblock"><pre>https://api.groq.com/openai/v1</pre><button class="copy" data-copy="https://api.groq.com/openai/v1">Copy</button></div>
                <div class="lesson">
                  <span class="tag">Custom</span>
                  <p>Pick <strong>Custom</strong> when your provider isn't in the list, and paste its base URL yourself. It has to be the OpenAI-compatible base — the part that ends in <code>/v1</code> — not a full chat URL copied out of the browser.</p>
                </div>
              </li>

              <li>
                <p>Cloud only — get a key from the provider's own dashboard and paste it into the <strong>API key</strong> field. For Groq that's <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a>, no card needed.</p>
                <div class="callout"><strong>The key is stored in this browser only.</strong> It is never written into a file and never committed to your repo. Use a free-tier or spend-capped key, and don't put one on a projector or in a group chat — a shared key is a drained quota by lunch.</div>
              </li>

              <li>
                <p>Click <strong>Test</strong>, and then <strong>Add</strong>.</p>
                <div class="lesson">
                  <span class="tag">What each button does</span>
                  <p><strong>Test</strong> pings <code>/models</code> on the endpoint, so it answers exactly one question: can the browser reach it at all. <strong>Add</strong> then auto-discovers every model that endpoint offers and lists them for you. If a provider hides its model list, the app falls back to a sensible default for that provider rather than showing you an empty picker, which is not an error.</p>
                </div>
              </li>

              <li>
                <p>Open the picker again, choose your model, type <strong>"Kumusta!"</strong>, and watch it reply word by word.</p>
                <div class="lesson">
                  <span class="tag">Reading the chip</span>
                  <p>The status chip at the top right now names the model you chose instead of just reading <strong>Ollama</strong>. That is your confirmation the endpoint and the selection both took. Added endpoints stay in the picker, so you can switch between local and cloud mid-conversation and compare the answers.</p>
                </div>
              </li>
            </ol>

            <div class="callout">Everything you add here is saved <strong>in this browser only</strong>. It makes <em>your</em> copy work, not your published one — the live site gets its model from a Vercel environment variable instead, which you set in Level 4.</div>`,
          proofs: [
            { key: 'card', type: 'choice', label: 'Which card did you use?', hint: 'Local is the camp default — pick Both only if you added a cloud endpoint as well', options: ['LOCAL — Ollama on my machine', 'API — a cloud provider', 'Both'], required: true },
            { key: 'provider', type: 'choice', label: 'If you used the API card, which provider?', options: ['Groq', 'DeepSeek', 'OpenAI', 'Together', 'Custom endpoint', 'Local only — no cloud provider'], required: false },
            { key: 'selected', type: 'text', label: 'Which model did you select in the app?', required: true },
            { key: 'shot', type: 'screenshot', label: 'The app replying, with the status chip naming your model', required: true },
          ],
          mentorNote: 'This is where the room splits, so stand up and watch it. ‘No models found’, or a Test that fails, means either Ollama isn’t running or the browser can’t reach it — have them open http://localhost:11434/v1/models directly, which answers both questions at once. The API card is the fallback for machines that can’t run anything locally; the very oldest hardware fails even on small models, and pairing them with a neighbour is the other fallback. Name the trade out loud: they finish the build but miss the local-first point, and can run it locally later. Have one spend-capped key of your own ready for the two or three who arrive without one, and revoke it after the camp.',
        },
      ],
    },
    {
      id: 'm3',
      title: 'Level 3 — Customize',
      steps: [
        {
          id: 'h3a',
          title: 'Name it and shape its personality',
          minutes: 20,
          body: `
            <p>Click the gear icon at the top right. Everything updates the live preview as you type — no code.</p>
            <p><strong>Settle on the name.</strong> You gave it one at first launch to get into the chat — this is where you change your mind. Bayani, Isko, Barangay AI, anything. It shows in the header, welcome screen, and avatars. Your own name is here too, and that's the one credited as the builder when you publish, so check it reads the way you want to be credited.</p>
            <p><strong>Shape its personality.</strong> Write how it behaves: friendly tutor, barangay helper, coding buddy. This is its <strong>system prompt</strong> — a hidden instruction given before the conversation starts, like a job description on someone's first day. There are presets and an AI-assisted expander if you want help writing one.</p>
            <p><strong>Then say what it is in plain words.</strong> The box below asks for one or two sentences — who it helps, and what it does for them. A system prompt is instructions to the model; nobody reading your post or your write-up wants to decode one to find out what you built. This is the line that introduces it, and it goes straight into your project documentation and the post you share at the end.</p>`,
          proofs: [
            { key: 'ainame', type: 'text', label: 'What did you name your AI?', required: true },
            { key: 'blurb', type: 'longtext', label: 'In a sentence or two, what is your AI?', hint: 'Plain words, no jargon — who it helps and what it does for them. This is what people read in your post and your documentation, so write it the way you would say it out loud', required: true },
            { key: 'prompt', type: 'longtext', label: 'Paste your system prompt', hint: "The actual text you wrote — this is the most interesting thing you'll make today", required: true },
            { key: 'shot', type: 'screenshot', label: 'Your AI, named and answering in character', required: true },
          ],
          mentorNote: 'This is the fun level. Let it run long if the room is engaged — customization is where people take ownership. The system prompts are also the best material for the closing demo, so keep an eye out for good ones. Watch the one-or-two-sentence description too: the usual first attempt is a paraphrase of the prompt, and ‘who is it for, and what do they get’ is the question that fixes it. Whatever they write there is what their post and write-up lead with.',
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
            <p>Open the <strong>Sources</strong> panel under any answer to see exactly which chunk of which file it used, and the similarity score that earned it a place.</p>
            <p>Then expand <strong>What the model actually read</strong> under the same answer. It accounts for every token the model received and where each one came from — your system prompt, the built-in answer rules, the reply language, the extra knowledge you wrote, the matching chunks pulled from your sources, the line you typed, and the earlier messages in the chat, each with its share of the total. Two things are worth noticing: the retrieved chunks are usually the largest slice by far, and what <em>you</em> typed is a percent or two of what the model read. The chips along the bottom name the model and its temperature, and <strong>Show the exact text</strong> prints the literal messages that went over the wire.</p>
            <p>The proof boxes below ask for your question, the reply, and a capture of that panel. The panel is the part that shows the answer came from your document and not from the model.</p>`,
          proofs: [
            { key: 'file', type: 'text', label: 'What document did you add?', hint: "Name and roughly what's in it", required: true },
            { key: 'asked', type: 'text', label: 'What did you ask it?', hint: 'Pick something only your file could answer — a name, a number, a date that is in no model anywhere', required: true },
            { key: 'replied', type: 'longtext', label: 'What did it answer?', hint: 'Paste the reply. Was it actually right?', required: true },
            { key: 'context', type: 'screenshot', label: 'The “What the model actually read” panel', hint: 'Expand it under the answer and capture the whole breakdown. The row for the matching chunks of your sources, and the share of the total it takes, are what show the answer came from your document', required: true },
            { key: 'shot', type: 'screenshot', label: 'Your question and its answer on screen', hint: 'The chat itself — your question, the reply, and the Sources panel expanded underneath so the file it quoted is named in the frame', required: true },
          ],
          mentorNote: 'If anyone says ‘it’s now trained on my file’, correct it there and then — grounded, not trained. Opening What the model actually read and pointing at the matching-chunks row is the single best teaching moment in the camp: the retrieved passages are usually half of what the model saw, and the participant’s own question is one percent of it. That panel is a required upload now, so a step where it is missing or still collapsed is obvious on the desk without reading a word. This step takes two screenshots, so tell them to click the box they mean before pasting.',
        },
      ],
    },
    {
      id: 'm4',
      title: 'Level 4 — Publish',
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
            <p>Two things happen here: your code goes online, then the live copy gets a key so visitors get replies. In that order.</p>

            <h4 class="opthead"><span class="tag">Part 1</span>Put the site online</h4>
            <ol>
              <li>Open <a href="https://vercel.com/dashboard" target="_blank" rel="noopener">vercel.com/dashboard</a>, signed in with the same GitHub account your fork lives on.</li>
              <li>Click <strong>Add New → Project</strong>.</li>
              <li>Find your fork in the list and click <strong>Import</strong>. Not there? Click <strong>Adjust GitHub App Permissions</strong>, give Vercel access to that repo, come back.</li>
              <li>Change nothing on the configure screen. The starter needs no config.</li>
              <li>Click <strong>Deploy</strong>. A minute or two is normal.</li>
              <li>Click <strong>Visit</strong> to get your live URL — <code>something.vercel.app</code>.</li>
            </ol>
            <p>Open it. The site looks like yours, but ask it a question and nothing comes back. That's Part 2.</p>

            <h4 class="opthead"><span class="tag">Part 2</span>Get a free model key</h4>
            <p>Visitors can't reach the Ollama on your laptop, so the live copy borrows a hosted model. Groq gives one away free — no card, no trial clock.</p>
            <ol>
              <li>Open <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a> in a new tab.</li>
              <li><strong>Sign up</strong> with Google, GitHub, or an email address. There is no payment step — if a screen asks for a card, you're on the wrong site.</li>
              <li>In the left sidebar of the console, click <strong>API Keys</strong>. On a narrow window that sidebar hides behind the <strong>☰</strong> button at the top-left.</li>
              <li>Click <strong>Create API Key</strong> and name it anything — <code>codecamp</code> is fine.</li>
              <li>The key is shown <strong>once</strong>. Copy it somewhere you can reach for the next two minutes. Close that box and it's gone for good — you can only make a new one.</li>
            </ol>
            <p>A Groq key starts with <code>gsk_</code>. If what you copied doesn't, you grabbed the wrong thing off the page.</p>

            <h4 class="opthead"><span class="tag">Part 3</span>Give the key to Vercel</h4>
            <ol>
              <li>Back in Vercel, open your project → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
              <li>In <strong>Key</strong>, type <code>MODEL_API_KEY</code> — exactly that, capitals and underscore. In <strong>Value</strong>, paste your <code>gsk_…</code> key.</li>
              <li>Leave it applied to every environment and click <strong>Save</strong>.</li>
              <li>The part everyone forgets: a new variable doesn't reach a site that's already deployed. Open <strong>Deployments</strong>, click the <strong>⋯</strong> menu on the newest one, choose <strong>Redeploy</strong>.</li>
              <li>When that finishes, open your live URL and ask your AI something. A reply means the key is in.</li>
            </ol>
            <p><code>MODEL_API_KEY</code> is the only variable you need to set, and it pays for exactly one thing: the model writing replies. Groq is only the default because it's free and fast — any other free hosted model works the same way, and the starter has optional settings for the endpoint and model name, so ask a facilitator if you'd rather use one. What matters is that a stranger who opens your link gets an answer back.</p>

            <div class="callout"><strong>Never paste a key into a file you commit.</strong> Your repo is public, and keys in public repos get found and drained within hours. <code>my-ai.json</code> is written without any key by design. Use a free-tier or spend-capped key — the proxy caps reply length but has no per-IP rate limit yet, so a public link is a public endpoint backed by your quota.</div>`,
          proofs: [
            { key: 'liveurl', type: 'text', label: 'Your live URL', hint: 'Something like your-ai.vercel.app — open it on your phone before you submit', required: true },
            { key: 'keywhere', type: 'choice', label: 'Where did your key end up?', hint: 'A safety check, not a test — every answer moves you on. If the key did land in a file in your repo, saying so is how a facilitator reaches you before a stranger does', options: ['In Vercel environment variables', 'In a file in my repo', "I haven't added one yet"], required: true },
            { key: 'shot', type: 'screenshot', label: 'Your live site in a browser, URL bar visible', required: true },
          ],
          mentorNote: 'Say the key warning out loud at least twice. The key question is self-reported and nothing blocks on the answer — deliberately, since an honest ‘in a file in my repo’ beats a gate people learn to click past. Watch the roster for that answer and go straight to them: the key needs rotating, not just moving. If the room is behind on time, this is the step to protect: get everyone published and pushed, and let the deploy happen after the camp.',
        },
        {
          id: 'h4d',
          title: 'Wrap up',
          minutes: 10,
          body: `
            <div class="callout"><strong>Remember which one is the real one.</strong> The shared link runs on somebody else's computer, using a hosted model. The AI on <em>your</em> machine is the one that's free, offline, and private — nobody can meter it, price it, or switch it off. That's the one you actually built today.</div>
            <p>Tell us how the day went. Four dropdowns are required and the rest is optional — two minutes, and it genuinely shapes the next camp.</p>
            <p>These answers go to the facilitator, not into your public write-up. The one exception is which level you found hardest, which appears in your write-up under <em>What I learned</em>.</p>`,
          proofs: [
            { key: 'pace', type: 'choice', label: 'How was the pace?', options: ['Too slow', 'About right', 'Too fast'], required: true },
            { key: 'hardest', type: 'choice', label: 'Which level was hardest?', options: ['Pre-install', 'Level 1 — Fork', 'Level 2 — Run it locally', 'Level 3 — Customize', 'Level 4 — Publish'], required: true },
            { key: 'again', type: 'choice', label: 'Could you build this again tomorrow, on your own?', hint: 'Nobody is marking this — “not yet” is a normal answer after one day, and it tells us which parts to slow down next time', options: ['Yes, from scratch', 'Yes, with this checklist open', 'Not yet — I followed along'], required: true },
            { key: 'recommend', type: 'choice', label: 'Would you tell a friend to come to the next one?', options: ['Definitely', 'Probably', 'Probably not'], required: true },
            { key: 'stuck', type: 'choice', label: 'When you got stuck, how long did you stay stuck?', hint: 'How quickly help reached you — this is about us, not you', options: ['Never really got stuck', 'A few minutes', 'Long enough to fall behind', 'I never got it working'], required: false },
            { key: 'next', type: 'choice', label: 'What happens to your AI after today?', options: ['Keep building on it', 'Leave it up as it is', 'Take it down', 'Not sure yet'], required: false },
            { key: 'bestbit', type: 'text', label: 'What is the one thing you will remember?', hint: 'A moment, not a review — the bit where something clicked', required: false },
            { key: 'feedback', type: 'longtext', label: 'Anything we should change?', hint: 'Optional, but read by a human', required: false },
          ],
          mentorNote: 'Collect this before people leave the room — response rate drops off a cliff once they’re out the door. Hardest level is your planning data for the next camp; expect Level 2 to win and budget accordingly. ‘Could you build this again’ and the stuck question are the two that tell you whether the day taught anything or just got followed: a room that finished but answers ‘not yet’ across the board means the pace was too fast whatever the pace answers say, and ‘long enough to fall behind’ clustering on one level means you were short a facilitator there. Only four of the eight are required, so nobody is trapped at the door.',
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
