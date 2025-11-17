// --- Elements ---
const codeInput = document.getElementById("codeInput");
const outputBox = document.getElementById("output");
const inputArea = document.getElementById("inputArea"); // Dedicated STDIN box
const inputContainer = document.getElementById("inputContainer"); // STDIN wrapper
const languageSelect = document.getElementById("language");
const runBtn = document.getElementById("runBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn"); 
const currentLang = document.getElementById("currentLang");
const execStats = document.getElementById("execStats"); 

// --- New Elements for Loading/Offline ---
const mainContent = document.getElementById("mainContent");
const offlineOverlay = document.getElementById("offlineOverlay");
const codeLoader = document.getElementById("codeLoader");
const outputLoader = document.getElementById("outputLoader");


// --- Configuration ---
const languages = { 
    python:71, 
    cpp:54, 
    c:50, 
    java:62, 
    javascript:63 
};

const extensions = {
    python: 'py',
    cpp: 'cpp',
    c: 'c',
    java: 'java', 
    javascript: 'js'
};

const RUN_API = "https://ce.judge0.com/submissions/?base64_encoded=false&wait=true";


// --- Utility Function: Debouncing ---
/**
 * Returns a function that delays invoking func until after wait milliseconds 
 * have elapsed since the last time the debounced function was invoked.
 */
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// --- Skeletal Loading Management ---

const showLoaders = () => {
    codeInput.classList.add('hidden');
    outputBox.classList.add('hidden');
    codeLoader.classList.remove('hidden');
    outputLoader.classList.remove('hidden');
    runBtn.disabled = true;
};

const hideLoaders = () => {
    // Simulate a minimum load time for effect
    setTimeout(() => {
        codeLoader.classList.add('hidden');
        outputLoader.classList.add('hidden');
        codeInput.classList.remove('hidden');
        outputBox.classList.remove('hidden');
        runBtn.disabled = false;
    }, 500); 
};


// --- Online Status Check (Mandatory for API) ---

const checkOnlineStatus = () => {
    if (navigator.onLine) {
        offlineOverlay.classList.add('hidden');
        mainContent.classList.remove('hidden');
        showLoaders(); // Start with loaders visible
        
        // Simulating the API check/startup time
        setTimeout(() => {
            initializeTerminal(false); // Initialize content
            hideLoaders(); // Hide loaders after content is ready
        }, 1000); // 1 second delay for full loading experience

    } else {
        // Force an error state if offline
        mainContent.classList.add('hidden');
        offlineOverlay.classList.remove('hidden');
    }
};

window.addEventListener('load', checkOnlineStatus);
window.addEventListener('online', checkOnlineStatus); // Check again if connection returns


// --- Feature 1: Dynamic Input Box Visibility ---
const INPUT_KEYWORDS = {
    python: /input\s*\(/i,
    cpp: /std::cin|scanf|getline\s*\(/i,
    c: /scanf\s*\(/i,
    java: /Scanner|BufferedReader|System\.in\.read/i, 
    javascript: /prompt|readline|fs\.readFileSync/i 
};

function toggleInputVisibility() {
    const code = codeInput.value;
    const lang = languageSelect.value;
    const regex = INPUT_KEYWORDS[lang];
    
    // Check if the code contains any input keyword for the current language
    if (regex && regex.test(code)) {
        inputContainer.classList.remove('hidden');
    } else {
        inputContainer.classList.add('hidden');
    }
}


// --- Initial Setup & Helpers ---
const initializeTerminal = (shouldClearCode = false) => {
    // 1. Clear all
    outputBox.textContent = "DX IDE Ready. Output will appear here after running your code.";
    execStats.classList.add('hidden'); 

    // 2. Clear code and input as requested
    if (shouldClearCode) {
        codeInput.value = ""; 
    }
    inputArea.value = ""; 

    // 3. Update status and input visibility (Input visibility will be correct based on empty code)
    currentLang.textContent = languageSelect.options[languageSelect.selectedIndex].textContent;
    toggleInputVisibility(); 
};


// --- UI Interaction ---
languageSelect.addEventListener("change", () => {
  initializeTerminal(true); 
});

clearBtn.addEventListener("click", () => {
  initializeTerminal(true); 
});

// Update visibility on code typing 
const debouncedToggle = debounce(() => {
    // Clear input area when fresh code is typed/modified
    inputArea.value = ""; 
    toggleInputVisibility(); 
}, 300); // Wait 300ms after the last keypress

codeInput.addEventListener('input', debouncedToggle);


// --- Feature 2: Code Download (Unchanged) ---
downloadBtn.addEventListener("click", () => {
    const code = codeInput.value;
    const lang = languageSelect.value;
    const ext = lang === 'java' ? 'java' : extensions[lang] || 'txt'; 
    const filename = `main.${ext}`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(code));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
});


// --- Feature 3: Code Editor Improvements (Auto-Indentation/Tab) ---
codeInput.addEventListener('keydown', function(e) {
    // Handle Tab for indentation
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;

        this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
    } 
    // Handle Enter for intelligent indentation
    else if (e.key === 'Enter') {
        e.preventDefault();
        const start = this.selectionStart;
        const value = this.value;

        const pre = value.substring(0, start);
        const lastLineBreak = pre.lastIndexOf('\n');
        const currentLine = pre.substring(lastLineBreak + 1);

        const match = currentLine.match(/^(\s*)/);
        let currentIndent = match ? match[0] : '';
        let newIndent = currentIndent;
        
        // Increase indent on block start (Python ':', C/Java/JS '{')
        if (currentLine.trim().endsWith(':') || currentLine.trim().endsWith('{')) {
            newIndent += '    ';
        }
        
        const newValue = value.substring(0, start) + '\n' + newIndent + value.substring(start);
        this.value = newValue;

        this.selectionStart = this.selectionEnd = start + newIndent.length + 1;
    }
});


// --- API Integration (Core Execution Logic with Input Guidance) ---
runBtn.addEventListener("click", async ()=>{
  // Check online status before running
  if (!navigator.onLine) {
    outputBox.textContent = "🔌 **OFFLINE ERROR:** Please connect to the internet to run the code.";
    execStats.classList.add('hidden');
    return;
  }
    
  const code = codeInput.value.trim();
  
  if(!code){ outputBox.textContent="⚠️ Enter code!"; return; }
  
  const inputToEcho = inputArea.value; 
  const lang = languageSelect.value;
  
  outputBox.textContent="⏳ Running...";
  execStats.classList.add('hidden'); 
  
  runBtn.disabled = true; // Disable run button during execution
  let finalCode = code;

  // Java class wrapper logic: Ensures main class is "Main" for compilation
  if(lang==="java"){
    const throwsIO = code.includes("BufferedReader") ? "throws java.io.IOException" : "";
    
    if(code.includes("class") && !code.includes("class Main")){
        finalCode = code.replace(/(\s*(?:public|private|protected|abstract|final)?\s*class\s+)\S+/i, '$1Main');
    } 
    else if (!code.includes("public static void main")) {
        finalCode = `public class Main {\n    public static void main(String[] args) ${throwsIO} {\n` + code + "\n    }\n}";
    }
  }

  try{
    const res = await fetch(RUN_API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        source_code: finalCode, // Use finalCode
        language_id: languages[lang],
        stdin: inputToEcho 
      })
    });
    const data = await res.json();
    
    // --- Execution Stats Display ---
    if (data.time || data.memory) {
        let time = parseFloat(data.time) || 0;
        let memory = parseFloat(data.memory) || 0;
        execStats.textContent = `⚡ Time: ${time.toFixed(3)}s | 🧠 Mem: ${memory} KB`;
        execStats.classList.remove('hidden');
    }

    // --- Error Handling ---
    if(data.compile_output) {
        outputBox.textContent = "⚙️ Compile Error:\n" + data.compile_output;
        return;
    }

    if (data.stderr) {
        let errorOutput = data.stderr;
        
        // Custom guidance for missing input/EOF error
        const isInputError = (lang === 'java' && (errorOutput.includes('NoSuchElementException') || errorOutput.includes('IOException'))) || 
                             (lang === 'python' && errorOutput.includes('EOFError'));
        
        if (isInputError) {
             errorOutput = `❌ **RUNTIME ERROR: Missing Input (EOF)**\n\nYour program is trying to read data (e.g., a number, a string, or a line), but the **Standard Input (STDIN)** box below is empty or doesn't have enough lines of input to satisfy all read requests.\n\n***FIX:*** Please enter ALL required input values, ensuring each required value is on a new line, in the dedicated STDIN box below and run again.\n\n***Original Error:***\n${data.stderr}`;
        }
        
        outputBox.textContent = errorOutput;
        return;
    }

    // --- Output Display ---
    let outputText = data.stdout || "";
    
    let outputResult;
    if (outputText.trim().length > 0) {
        outputResult = outputText;
    } else {
        outputResult = "✅ Execution successful, but no output was printed.";
    }
    
    outputBox.textContent = outputResult;


  }catch(e){ 
    outputBox.textContent="🚨 **NETWORK ERROR:** Could not reach the code execution server. Check your connection or try again."; 
    execStats.classList.add('hidden');
    console.error(e);
  } finally {
      runBtn.disabled = false; // Re-enable button after execution
  }
});


// --- Theme toggle and Background particles (Unchanged) ---
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("change", ()=>{
  document.body.className = themeToggle.checked ? "theme-light" : "theme-default";
});

const canvas = document.getElementById("bgCanvas");
const ctx = canvas.getContext("2d");
let particles=[];
function initParticles(){
  canvas.width=innerWidth; canvas.height=innerHeight; particles=[];
  for(let i=0;i<100;i++){
    particles.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height, r:Math.random()*2+1, dx:(Math.random()-0.5)*0.5, dy:(Math.random()-0.5)*0.5});
  }
}
function animate(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  particles.forEach(p=>{
    p.x+=p.dx; p.y+=p.dy;
    if(p.x<0||p.x>canvas.width)p.dx*=-1;
    if(p.y<0||p.y>canvas.height)p.dy*=-1;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    // Use dynamic color based on theme
    const color = document.body.className.includes('light') ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.fillStyle=color;
    ctx.fill();
  });
  requestAnimationFrame(animate);
}
// Initial call setup (Only runs if online check passes)
// checkOnlineStatus() is the new entry point.
initParticles(); 
animate();