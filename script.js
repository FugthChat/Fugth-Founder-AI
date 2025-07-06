const APP = {
    config: {
        HUGGING_FACE_URL: "https://fugthchat-fugth-founder-ai.hf.space",
    },
    state: {
        isGenerating: false,
        activeModel: '',
        projectFiles: {},
        activeFile: '',
        workspaceType: 'software',
    },
    elements: {},

    init() {
        this.cacheElements();
        this.addEventListeners();
        this.api.checkServerStatus();
        this.ui.addLogMessage('Welcome', 'Describe your project idea and click Generate.', 'system');
    },

    cacheElements() {
        this.elements = {
            modelList: document.getElementById('model-list'),
            activeModelName: document.getElementById('active-model-name'),
            aiStatusDot: document.getElementById('ai-status-dot'),
            aiStatusText: document.getElementById('ai-status-text'),
            generateBtn: document.getElementById('generate-btn'),
            projectIdea: document.getElementById('project-idea'),
            codeVerbosity: document.getElementById('code-verbosity'),
            verbosityLabel: document.getElementById('verbosity-label'),
            stylePalette: document.getElementById('style-palette'),
            fileTree: document.getElementById('file-tree'),
            codeEditor: document.getElementById('code-editor'),
            currentFileName: document.getElementById('current-file-name'),
            aiLog: document.getElementById('ai-log'),
            refactorBtn: document.getElementById('refactor-btn'),
            testGenBtn: document.getElementById('test-gen-btn'),
            downloadBtn: document.getElementById('download-button'),
            downloadZipBtn: document.getElementById('download-zip-button'),
            modelSelectorBtn: document.getElementById('model-selector-button'),
            tabs: document.querySelectorAll('.tab-button'),
        };
    },

    addEventListeners() {
        this.elements.generateBtn.onclick = () => this.logic.handleGenerateProject();
        this.elements.refactorBtn.onclick = () => this.logic.handleRefactorCode();
        this.elements.testGenBtn.onclick = () => this.logic.handleGenerateTests();
        this.elements.downloadBtn.onclick = () => this.ui.toggleDropdown('download-container');
        this.elements.downloadZipBtn.onclick = (e) => {
            e.preventDefault();
            this.logic.downloadZip();
        };
        this.elements.modelSelectorBtn.onclick = () => this.ui.toggleDropdown('model-selector-container');
        this.elements.codeVerbosity.oninput = (e) => this.ui.updateVerbosityLabel(e.target.value);
        this.elements.tabs.forEach(tab => {
            tab.onclick = () => this.ui.switchWorkspace(tab.id === 'tab-site' ? 'site' : 'software', tab);
        });

        this.elements.codeEditor.addEventListener('input', () => {
             if (this.state.activeFile && this.state.projectFiles[this.state.activeFile]) {
                this.state.projectFiles[this.state.activeFile].content = this.elements.codeEditor.textContent;
            }
        });
    },

    // --- UI Subsystem ---
    ui: {
        toggleDropdown(containerId) {
            document.getElementById(containerId).querySelector('.absolute').classList.toggle('hidden');
        },
        selectModel(modelId, modelName) {
            APP.state.activeModel = modelId;
            APP.elements.activeModelName.textContent = modelName;
            this.toggleDropdown('model-selector-container');
        },
        switchWorkspace(workspace, clickedTab) {
            APP.state.workspaceType = workspace;
            APP.elements.tabs.forEach(tab => {
                tab.classList.remove('text-white');
                tab.style.borderColor = 'transparent';
                tab.classList.add('text-slate-400');
            });
            clickedTab.classList.add('text-white');
            clickedTab.style.borderColor = 'var(--accent-color)';
            clickedTab.classList.remove('text-slate-400');
            APP.elements.projectIdea.placeholder = workspace === 'site' 
                ? "e.g., A portfolio website with a home, about, and contact page."
                : "e.g., A simple command-line calculator.";
        },
        updateVerbosityLabel(value) {
            APP.elements.verbosityLabel.textContent = `${value} Lines`;
        },
        selectFile(fileName) {
            if (!APP.state.projectFiles[fileName]) return;

            APP.state.activeFile = fileName;
            APP.elements.currentFileName.textContent = fileName;

            const file = APP.state.projectFiles[fileName];
            
            APP.elements.codeEditor.innerHTML = ''; // Clear previous content
            
            if (fileName.endsWith('.md')) {
                APP.elements.codeEditor.innerHTML = marked.parse(file.content);
                APP.elements.codeEditor.setAttribute('contenteditable', 'false');
            } else {
                const codeEl = document.createElement('code');
                codeEl.className = `language-${file.language || 'plaintext'}`;
                codeEl.textContent = file.content;
                APP.elements.codeEditor.appendChild(codeEl);
                hljs.highlightElement(codeEl);
                APP.elements.codeEditor.setAttribute('contenteditable', 'true');
            }
            
            document.querySelectorAll('#file-tree .file-item').forEach(item => {
                item.classList.toggle('bg-slate-700', item.dataset.filename === fileName);
            });
            APP.elements.refactorBtn.disabled = false;
            APP.elements.testGenBtn.disabled = file.language === 'python';
        },
        addLogMessage(title, message, type = 'info') {
            const colorMap = { info: 'sky', success: 'emerald', system: 'indigo', error: 'red' };
            const logEntry = document.createElement('div');
            logEntry.className = 'p-2 rounded-md bg-slate-700/50';
            logEntry.innerHTML = `<p class="font-semibold text-${colorMap[type]}-400">${title}</p><p class="text-slate-400 text-xs">${message}</p>`;
            APP.elements.aiLog.appendChild(logEntry);
            APP.elements.aiLog.scrollTop = APP.elements.aiLog.scrollHeight;
        },
        updateAIStatus(status, text) {
            this.elements.aiStatusDot.className = 'w-3 h-3 rounded-full transition-colors';
            switch (status) {
                case 'thinking': this.elements.aiStatusDot.classList.add('pulse-bg-animation', 'bg-yellow-500'); break;
                case 'error': this.elements.aiStatusDot.classList.add('bg-red-500'); break;
                default: this.elements.aiStatusDot.classList.add('bg-green-500'); break;
            }
            this.elements.aiStatusText.textContent = text;
        },
    },

    // --- API Subsystem ---
    api: {
        async checkServerStatus() {
            try {
                const response = await fetch(APP.config.HUGGING_FACE_URL);
                if (!response.ok) throw new Error(`Server offline (${response.status})`);
                const data = await response.json();
                
                APP.ui.updateAIStatus('ready', 'Ready');
                APP.elements.generateBtn.disabled = false;
                
                APP.elements.modelList.innerHTML = '';
                let firstModelSet = false;
                for (const modelId in data.available_models) {
                    const model = data.available_models[modelId];
                    const modelElement = document.createElement('a');
                    modelElement.href = '#';
                    modelElement.className = 'block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700';
                    modelElement.textContent = model.name;
                    modelElement.onclick = (e) => { e.preventDefault(); APP.ui.selectModel(modelId, model.name); };
                    APP.elements.modelList.appendChild(modelElement);
                    if (!firstModelSet) {
                        APP.ui.selectModel(modelId, model.name);
                        firstModelSet = true;
                    }
                }
            } catch (error) {
                APP.ui.updateAIStatus('error', 'Connection Failed');
                console.error("Connection error:", error);
                setTimeout(() => this.checkServerStatus(), 5000);
            }
        },
        async streamAIResponse(prompt, onChunk, onComplete, onError) {
            APP.ui.updateAIStatus('thinking', 'Thinking...');
            APP.state.isGenerating = true;
            APP.elements.generateBtn.disabled = true;
            APP.elements.refactorBtn.disabled = true;
            APP.elements.testGenBtn.disabled = true;

            try {
                const response = await fetch(`${APP.config.HUGGING_FACE_URL}/chat_stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, model_id: APP.state.activeModel }),
                });
                if (!response.ok) throw new Error(`Request failed: ${response.status} ${await response.text()}`);
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    onChunk(decoder.decode(value, { stream: true }));
                }
                onComplete();
            } catch (error) {
                onError(error);
            } finally {
                APP.ui.updateAIStatus('ready', 'Ready');
                APP.state.isGenerating = false;
                APP.elements.generateBtn.disabled = false;
                APP.elements.refactorBtn.disabled = !APP.state.activeFile;
                APP.elements.testGenBtn.disabled = !(APP.state.activeFile && APP.state.projectFiles[APP.state.activeFile]?.language === 'python');
            }
        },
    },

    // --- Logic Subsystem ---
    logic: {
        createPrompt(task, context) {
            const base = `You are FugthAI, an expert software architect.`;
            const projectContext = `
                **Project Idea:** "${APP.elements.projectIdea.value}"
                **Approximate Lines of Code:** ${APP.elements.codeVerbosity.value}
                **Coding Style:** ${APP.elements.stylePalette.value}
                **Workspace Type:** ${APP.state.workspaceType}
            `;
            const fileContext = `
                **File Name:** "${APP.state.activeFile}"
                **File Content:**
                \`\`\`${APP.state.projectFiles[APP.state.activeFile]?.language}
                ${context.code}
                \`\`\`
            `;

            const tasks = {
                generate: {
                    instruction: `Based on the following idea, generate a complete project structure with filenames and their full code content.
                        **Instructions:**
                        1. Create a logical file structure.
                        2. For each file, provide its name and the complete, raw code content.
                        3. Use "<<<FILE_SEPARATOR>>>" to separate each file's information.
                        4. Format each file's data as: \`filename.ext\n[code content]\`
                        5. Do NOT include any other text or explanations outside this structure.`,
                    context: projectContext
                },
                refactor: {
                    instruction: `Refactor the following code. Improve its readability, efficiency, and adherence to best practices without changing its core functionality. Return ONLY the complete, raw, refactored code.`,
                    context: fileContext
                },
                generate_tests: {
                    instruction: `Generate a new test file with comprehensive unit tests for the following Python code. The test file should be named "test_${APP.state.activeFile}". Use the pytest framework. Return the filename and code content using the specified format: \`test_filename.py\n[test code content]\``,
                    context: fileContext
                }
            };
            
            return `${base}\n${tasks[task].instruction}\n${tasks[task].context}`;
        },

        handleGenerateProject() {
            if (!APP.elements.projectIdea.value.trim() || APP.state.isGenerating) return;
            APP.elements.aiLog.innerHTML = '';
            APP.ui.addLogMessage("Task Started", "Analyzing project requirements...", "info");
            const prompt = this.createPrompt('generate');
            let fullResponse = '';
            APP.api.streamAIResponse(
                prompt,
                (chunk) => { fullResponse += chunk; },
                () => { this.parseAndRenderProject(fullResponse); },
                (error) => { APP.ui.addLogMessage("Error", `Generation failed: ${error.message}`, "error"); }
            );
        },
        parseAndRenderProject(response) {
            APP.state.projectFiles = {};
            APP.elements.fileTree.innerHTML = '';
            
            const files = response.split('<<<FILE_SEPARATOR>>>');
            files.forEach(fileData => {
                const trimmedData = fileData.trim();
                const firstNewlineIndex = trimmedData.indexOf('\n');
                if (!trimmedData || firstNewlineIndex === -1) return;

                const fileName = trimmedData.substring(0, firstNewlineIndex).trim();
                let content = trimmedData.substring(firstNewlineIndex + 1);
                
                const lang = fileName.split('.').pop();
                const langMap = { py: 'python', md: 'markdown', js: 'javascript', html: 'html', css: 'css', txt: 'plaintext' };
                
                APP.state.projectFiles[fileName] = { content, language: langMap[lang] || 'plaintext' };

                const li = document.createElement('li');
                li.innerHTML = `<span class="file-item flex items-center gap-2 cursor-pointer p-1 rounded-md hover:bg-slate-700" data-filename="${fileName}">
                    <svg class="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <span class="file-name truncate">${fileName}</span></span>`;
                li.querySelector('.file-item').onclick = () => APP.ui.selectFile(fileName);
                APP.elements.fileTree.appendChild(li);
            });

            const firstFile = Object.keys(APP.state.projectFiles)[0];
            if (firstFile) {
                APP.ui.selectFile(firstFile);
                APP.ui.addLogMessage("Success", "Project generated successfully.", "success");
            } else {
                 APP.ui.addLogMessage("Error", "The AI did not produce a valid project structure.", "error");
            }
        },
        handleRefactorCode() {
             const code = APP.elements.codeEditor.textContent;
             if (!code.trim() || !APP.state.activeFile || APP.state.isGenerating) return;
             APP.ui.addLogMessage("Refactoring", `Asking AI to improve ${APP.state.activeFile}...`, "info");
             const prompt = this.createPrompt('refactor', { code });
             let fullResponse = '';
             APP.api.streamAIResponse(
                prompt,
                (chunk) => { 
                    fullResponse += chunk;
                    if(APP.elements.codeEditor.querySelector('code')) {
                        APP.elements.codeEditor.querySelector('code').textContent = fullResponse;
                    }
                },
                () => {
                     APP.state.projectFiles[APP.state.activeFile].content = fullResponse;
                     if(APP.elements.codeEditor.querySelector('code')) {
                        hljs.highlightElement(APP.elements.codeEditor.querySelector('code'));
                     }
                     APP.ui.addLogMessage("Success", `${APP.state.activeFile} has been refactored.`, "success");
                },
                (error) => {
                     APP.ui.addLogMessage("Error", `Refactor failed: ${error.message}`, "error");
                }
             );
        },
        handleGenerateTests() {
            const code = APP.elements.codeEditor.textContent;
            if (!code.trim() || !APP.state.activeFile || APP.state.isGenerating) return;
            APP.ui.addLogMessage("Generating Tests", `Creating pytest file for ${APP.state.activeFile}...`, "info");
            const prompt = this.createPrompt('generate_tests', { code });
            let fullResponse = '';
            APP.api.streamAIResponse(
                prompt,
                (chunk) => { fullResponse += chunk; },
                () => { this.parseAndRenderProject(fullResponse); },
                (error) => { APP.ui.addLogMessage("Error", `Test generation failed: ${error.message}`, "error"); }
            );
        },
        downloadZip() {
            if (Object.keys(APP.state.projectFiles).length === 0) {
                alert("Please generate a project first!");
                return;
            }
            const zip = new JSZip();
            for (const fileName in APP.state.projectFiles) {
                zip.file(fileName, APP.state.projectFiles[fileName].content);
            }
            zip.generateAsync({ type: "blob" }).then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = "fugth-project.zip";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => APP.init());
</script>

</body>
</html>
