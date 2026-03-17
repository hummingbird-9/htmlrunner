let editor;
let files = {};
let currentFile = null;

// Supported extensions and editor modes
const modeByExtension = {
  '.html': 'htmlmixed',
  '.htm': 'htmlmixed',
  '.css': 'css',
  '.js': 'javascript',
  '.json': 'application/json',
  '.java': 'text/x-java',
  '.wasm': 'wasm' // WASM no mode, keep plain text
};

// Some file extensions to language labels (for dropdown)
const langByExtension = {
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.js': 'JavaScript',
  '.json': 'JSON',
  '.java': 'Java',
  '.wasm': 'WASM'
};

function getExtension(filename) {
  let dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.substr(dot).toLowerCase();
}

function guessMode(filename) {
  let ext = getExtension(filename);
  return modeByExtension[ext] || 'plaintext';
}

function createEditor(mode, value) {
  if (editor) editor.toTextArea();

  editor = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
    lineNumbers: true,
    mode: mode,
    theme: "default",
    indentUnit: 4,
    tabSize: 4,
    lineWrapping: true,
    autofocus: true,
    matchBrackets: true,
  });
  editor.setValue(value);
}

function renderFileList() {
  const list = document.getElementById('fileList');
  list.innerHTML = '';

  for (const fname in files) {
    const li = document.createElement('li');
    li.textContent = fname;
    if (fname === currentFile) li.classList.add('active');
    li.onclick = () => selectFile(fname);
    list.appendChild(li);
  }
}

function selectFile(filename) {
  if (!files.hasOwnProperty(filename)) return;
  currentFile = filename;

  let mode = guessMode(filename);
  createEditor(mode, files[filename] || '');
  document.getElementById('languageSelect').value = filename;
  updateLanguageDropdown(filename);

  // enable languageSelect only for text files (except WASM)
  document.getElementById('languageSelect').disabled = mode === 'wasm';

  renderFileList();
}

// Updates the language dropdown options to only show current file's language (for demo) 
function updateLanguageDropdown(filename) {
  let langSelect = document.getElementById('languageSelect');
  langSelect.innerHTML = '';

  let ext = getExtension(filename);
  if (ext === '.html' || ext === '.htm') langSelect.appendChild(new Option('HTML', 'htmlmixed'));
  else if (ext === '.css') langSelect.appendChild(new Option('CSS', 'css'));
  else if (ext === '.js') langSelect.appendChild(new Option('JavaScript', 'javascript'));
  else if (ext === '.json') langSelect.appendChild(new Option('JSON', 'application/json'));
  else if (ext === '.java') langSelect.appendChild(new Option('Java', 'text/x-java'));
  else if (ext === '.wasm') langSelect.appendChild(new Option('WASM', 'plaintext'));
  else langSelect.appendChild(new Option('Plain Text', 'plaintext'));

  langSelect.value = modeByExtension[ext] || 'plaintext';
}

function addFile(filename = 'newfile.html') {
  // Ensure unique filename
  let base = filename, count = 1;
  while (files.hasOwnProperty(filename)) {
    let ext = '';
    const dotIndex = base.lastIndexOf('.');
    if (dotIndex >= 0) {
      ext = base.substr(dotIndex);
      base = base.substr(0, dotIndex);
    }
    filename = base + count + ext;
    count++;
  }
  files[filename] = getDefaultContentForExtension(getExtension(filename));
  selectFile(filename);
  renderFileList();
}

function getDefaultContentForExtension(ext) {
  switch (ext) {
    case '.html': return `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>Document</title></head>\n<body>\n\n</body>\n</html>`;
    case '.css': return `/* Write your CSS here */\nbody {\n  font-family: Arial, sans-serif;\n}`;
    case '.js': return `// Write your JavaScript here\nconsole.log('Hello, world!');`;
    case '.json': return `{\n  "name": "example",\n  "version": "1.0.0"\n}`;
    case '.java': return `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}`;
    case '.wasm': return `;; WASM binary files cannot be edited as text here. Upload only.`; 
    default: return '';
  }
}

function saveFile() {
  if (!currentFile) return;
  files[currentFile] = editor.getValue();
}

function uploadFilesHandler(event) {
  const fileList = event.target.files;
  if (!fileList) return;

  const promises = [];

  for (let file of fileList) {
    const reader = new FileReader();
    promises.push(new Promise(resolve => {
      reader.onload = (e) => {
        files[file.name] = e.target.result;
        resolve();
      };
      if (file.name.endsWith('.wasm')) {
        // WASM files must be read as ArrayBuffer for usage, but here store as base64 string
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    }));
  }

  Promise.all(promises).then(() => {
    if (!currentFile) {
      // Select first file uploaded
      currentFile = Object.keys(files)[0];
    }
    renderFileList();
    selectFile(currentFile);
  });
}

function runCode() {
  saveFile();

  // HTML must exist to run, find .html file or default to first .html found
  let htmlFileKey = Object.keys(files).find(f => f.toLowerCase().endsWith('.html')) || null;
  if (!htmlFileKey) {
    alert('Error: You must have at least one HTML file to run.');
    return;
  }

  // Build output HTML:
  let html = files[htmlFileKey];

  // Extract <head> and <body> separately for injection
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  let headContent = headMatch ? headMatch[1] : '';
  let bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Inject all CSS files as <style> 
  for (let fname in files) {
    if (fname === htmlFileKey) continue;
    if (fname.toLowerCase().endsWith('.css')) {
      headContent += `<style>\n${files[fname]}\n</style>\n`;
    }
  }

  // Inject all JS files as <script> at end of body
  for (let fname in files) {
    if (fname === htmlFileKey) continue;
    if (fname.toLowerCase().endsWith('.js')) {
      bodyContent += `\n<script>\n${files[fname]}\n</script>\n`;
    }
  }

  // Inject JSON files as scripts with type application/json and id for usage in JS (optional)
  for (let fname in files) {
    if (fname === htmlFileKey) continue;
    if (fname.toLowerCase().endsWith('.json')) {
      let id = fname.replace(/\W/g, '_'); // sanitized id
      bodyContent += `\n<script type="application/json" id="${id}">\n${files[fname]}\n</script>\n`;
    }
  }

  // Handle WASM files:
  // We'll create blob URLs and inject a loader script if any WASM files present
  let wasmFiles = Object.keys(files).filter(f => f.toLowerCase().endsWith('.wasm'));
  let wasmScripts = '';

  if (wasmFiles.length > 0) {
    // We'll create blobs urls from base64 strings or ArrayBuffer (need to handle that)
    // Since we load WASM as ArrayBuffer (stored as string?), to keep simple, don't allow editing WASM, only upload

    // Create blobs for the WASM files on runtime
    wasmFiles.forEach(wasmFile => {
      // Blob URL code will be created dynamically during runtime via parent <script>
      // We inject a stub script that loads WASM, user can access it via JavaScript globally if needed
      wasmScripts += `
      // Load WASM: ${wasmFile}
      fetch('${wasmFile}').then(response => response.arrayBuffer())
        .then(buffer => WebAssembly.instantiate(buffer))
        .then(module => {
          window['wasm_${wasmFile.replace(/\W/g, '_')}'] = module.instance.exports;
          console.log('WASM module ${wasmFile} loaded');
        }).catch(console.error);
      `;
    });
    bodyContent += `<script>${wasmScripts}</script>`;
  }

  // Rebuild final html
  let finalHTML = `<!DOCTYPE html>
<html lang="en">
<head>
${headContent}
</head>
<body>
${bodyContent}
</body>
</html>`;

  // Set iframe output
  const iframe = document.getElementById('htmlOutput');
  iframe.srcdoc = finalHTML;
}

window.onload = () => {
  document.getElementById('addFileBtn').onclick = () => {
    const name = prompt('Enter new filename with extension (.html, .css, .js, .json, .java, .wasm)');
    if (!name) return alert('Filename is required');
    if (files[name]) return alert('File already exists');
    addFile(name);
  };
  document.getElementById('saveFileBtn').onclick = () => {
    saveFile();
    alert('File saved.');
  };
  document.getElementById('runBtn').onclick = () => {
    runCode();
  };
  document.getElementById('uploadBtn').onclick = () => {
    document.getElementById('uploadFiles').click();
  };
  document.getElementById('uploadFiles').addEventListener('change', uploadFilesHandler);

  // Initialize with one HTML file
  addFile('index.html');
};
