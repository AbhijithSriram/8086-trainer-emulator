// API base URL
const API_BASE = '';  // Empty for same origin

// ==========================================
//  PRESET PROGRAMS (Hardcoded for 1000H)
// ==========================================

const PRESETS = {
    // 1. 8-Bit Arithmetic (Add & Sub)
    'math8': {
        startAddr: '1000',
        code: `; 1. 8-BIT ADDITION & SUBTRACTION
; A) Addition: FF + FF (Stress Test)
MOV SI, 2000
MOV AL, [SI]      ; Load FF
INC SI
MOV BL, [SI]      ; Load FF
ADD AL, BL        ; Result FE, Carry=1
MOV DL, 00
ADC DL, 00        ; DL becomes 01
MOV SI, 2002
MOV [SI], AL      ; Store Sum (FE)
INC SI
MOV [SI], DL      ; Store Carry (01)

; B) Subtraction: 05 - 0A (Borrow Test)
MOV SI, 2000
MOV AL, 05
MOV BL, 0A
SUB AL, BL        ; Result FB, Borrow=1
MOV DL, 00
SBB DL, 00        ; DL becomes FF (-1)
MOV SI, 2004
MOV [SI], AL      ; Store Diff
INC SI
MOV [SI], DL      ; Store Borrow
HLT`,
        memory: { addr: '2000', data: [0xFF, 0xFF] }
    },

    // 2. 8-Bit Mul & Div
    'muldiv8': {
        startAddr: '1000',
        code: `; 2. 8-BIT MUL & DIV
; A) Multiply FF * FF (Max 8-bit)
MOV SI, 2000
MOV AL, [SI]      ; Load FF
MOV BL, [SI]      ; Load FF
MUL BL            ; Result FE01 in AX
MOV SI, 2002
MOV [SI], AX      ; Store FE01

; B) Divide F0 / 02
MOV AX, 0000      ; Clear AX
MOV AL, 0F0H      ; Load F0
MOV BL, 02
DIV BL            ; AL=78 (Quot), AH=00 (Rem)
MOV SI, 2004
MOV [SI], AL      ; Store Quot
INC SI
MOV [SI], AH      ; Store Rem
HLT`,
        memory: { addr: '2000', data: [0xFF, 0xFF] } // Fixed: Now provides 2 bytes
    },

    // 3. 16-Bit Addition & Subtraction
    'math16': {
        startAddr: '1000',
        code: `; 3. 16-BIT ADD & SUB
; A) Add: FFFF + 0001
MOV SI, 2000
MOV AX, [SI]      ; Load FFFF
INC SI
INC SI
MOV BX, [SI]      ; Load 0001
ADD AX, BX        ; Sum=0000, Carry=1
MOV DX, 0000
ADC DX, 0000      ; Add Carry
MOV SI, 2004
MOV [SI], AX      ; Store Sum
INC SI
INC SI
MOV [SI], DX      ; Store Carry

; B) Sub: 0005 - 000A
MOV AX, 0005
MOV BX, 000A
SUB AX, BX        ; Result FFFB, Borrow=1
MOV DX, 0000
SBB DX, 0000      ; Handle Borrow
MOV SI, 2008
MOV [SI], AX      ; Store Diff
INC SI
INC SI
MOV [SI], DX      ; Store Borrow
HLT`,
        memory: { addr: '2000', data: [0xFF, 0xFF, 0x01, 0x00] }
    },

    // 4. 16-Bit Mul & Div
    'muldiv16': {
        startAddr: '1000',
        code: `; 4. 16-BIT MUL & DIV
; A) Mul: FFFF * FFFF (Max 16-bit)
MOV SI, 2000
MOV AX, [SI]      ; Load FFFF
MOV BX, AX        ; BX = FFFF
MUL BX            ; Result FFFE0001 (DX:AX)
MOV SI, 2002
MOV [SI], AX      ; Store Low Word
INC SI
INC SI
MOV [SI], DX      ; Store High Word

; B) Div: 1388 / 0064 (5000 / 100)
MOV AX, 1388      ; Dividend Low
MOV DX, 0000      ; Dividend High
MOV BX, 0064      ; Divisor
DIV BX            ; AX=32 (50), DX=00
MOV SI, 2006
MOV [SI], AX      ; Store Quot
HLT`,
        memory: { addr: '2000', data: [0xFF, 0xFF] }
    },

    // 5. 1s Complement (8 & 16 bit)
    'ones_comp': {
        startAddr: '1000',
        code: `; 5. 1s COMPLEMENT (NOT)
; 8-Bit
MOV AL, 00
NOT AL            ; Becomes FF
MOV SI, 2000
MOV [SI], AL

; 16-Bit
MOV AX, F0F0
NOT AX            ; Becomes 0F0F
INC SI
MOV [SI], AX
HLT`,
        memory: { addr: '2000', data: [0x00] }
    },

    // 6. 2s Complement (8 & 16 bit)
    'twos_comp': {
        startAddr: '1000',
        code: `; 6. 2s COMPLEMENT (NEG)
; 8-Bit
MOV AL, 01
NEG AL            ; Becomes FF (-1)
MOV SI, 2000
MOV [SI], AL

; 16-Bit
MOV AX, 0001
NEG AX            ; Becomes FFFF (-1)
INC SI
MOV [SI], AX
HLT`,
        memory: { addr: '2000', data: [0x00] }
    },

    // 7. Sum of Series (8-Bit)
    'sum8': {
        startAddr: '1000',
        code: `; 7. SUM OF SERIES (8-BIT)
; Input: Count=FF, Values=All FF
; Math: 255 * 255 = 65025 (FE01)
MOV SI, 2000
MOV CL, [SI]      ; Load Count (FF)
MOV AX, 0000
MOV BX, 0000
INC SI
; Loop starts at 100C
MOV BL, [SI]      ; Load Value
ADD AX, BX        ; Add to 16-bit AX
INC SI
DEC CL
JNZ 100C          ; Loop
MOV [SI], AX      ; Store FE01
HLT`,
        memory: { addr: '2000', data: new Array(256).fill(0xFF) }
    },

    // 8. Sum of Series (16-Bit)
    'sum16': {
        startAddr: '1000',
        code: `; 8. SUM OF SERIES (16-BIT)
MOV SI, 2000
MOV CL, [SI]      ; Load Count
MOV AX, 0000      ; Sum Low
MOV DX, 0000      ; Sum High
INC SI
INC SI
; Loop starts at 100B
ADD AX, [SI]      ; Add Number
JNC 1012       ; Skip carry inc
INC DX            ; Handle Carry
DEC CL
JNZ 100B          ; Loop
INC SI
INC SI
MOV [SI], AX      ; Store Low
INC SI
INC SI
MOV [SI], DX      ; Store High
HLT`,
        memory: { addr: '2000', data: [0x03, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0x02, 0x00] }
    },

    // 9. Largest & Smallest
    'minmax': {
        startAddr: '1000',
        code: `; 9. LARGEST & SMALLEST
MOV SI, 2000
MOV CL, [SI]      ; Count
INC SI
MOV AL, [SI]      ; Init Max
MOV BL, [SI]      ; Init Min
DEC CL
; Loop start 100C
INC SI
; Check Max
CMP AL, [SI]
JNB 1015          ; Skip if Max >= Next
MOV AL, [SI]      ; Update Max
; Check Min
CMP BL, [SI]
JC 1019           ; Skip if Min < Next
MOV BL, [SI]      ; Update Min
DEC CL
JNZ 100C          ; Loop
MOV DI, 3000
MOV [DI], AL      ; Store Max
INC DI
MOV [DI], BL      ; Store Min
HLT`,
        memory: { addr: '2000', data: [0x05, 0x12, 0x05, 0x99, 0x01, 0x88] }
    },

    // 10. Sorting (Ascending & Descending)
    'sort': {
        startAddr: '1000',
        code: `; 10. SORT ARRAY
; Change JNB to JNA for Descending
MOV SI, 1300
MOV CL, [SI]      ; Outer Count
; Outer Loop (1005)
MOV SI, 1300
MOV DL, [SI]      ; Inner Count
INC SI
MOV AL, [SI]      ; Load Current
DEC DL
JZ 1027           ; -> NEXT_PASS
; Inner Loop (1011)
INC SI
MOV BL, [SI]      ; Load Next
CMP AL, BL
JNB 101F          ; [ASC] Use JNA for DESC
DEC SI            ; Swap Logic
MOV [SI], AL
MOV AL, BL
JMP 1023          ; -> CONT
; NOSWAP (101F)
DEC SI
MOV [SI], BL
INC SI
; CONT (1023)
DEC DL
JNZ 1011          ; -> Inner Loop
; NEXT_PASS (1027)
MOV [SI], AL
DEC CL
JNZ 1005          ; -> Outer Loop
HLT`,
        memory: { addr: '1300', data: [0x04, 0xFF, 0x10, 0x80, 0x00] }
    },
    
    // Extra: Divide Error
    'diverror': {
        startAddr: '1000',
        code: `; EXTRA: DIVIDE BY ZERO
MOV AX, 1000
MOV BL, 00
DIV BL            ; This will trigger error
HLT`,
        memory: { addr: '2000', data: [0x00] }
    }
};

let executionSpeed = 500;
let isRunning = false;
let currentEditAddress = 0;

// Initialize - SINGLE Entry Point
document.addEventListener('DOMContentLoaded', function() {
    // 1. Initial Data Fetch
    updateMemoryView();
    updateRegisters();
    
    // 2. Setup Speed Slider
    const speedSlider = document.getElementById('speedSlider');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            executionSpeed = parseInt(e.target.value);
            document.getElementById('speedValue').textContent = e.target.value + 'ms';
        });
    }

    // 3. Setup Memory Editor (Enter Key)
    const memEditValue = document.getElementById('memEditValue');
    if (memEditValue) {
        memEditValue.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                writeMemoryByte();
            }
        });
    }

    // 4. Setup Address Gutter (The new IDE feature)
    const codeInput = document.getElementById('codeInput');
    const startAddrInput = document.getElementById('startAddress');
    const addressGutter = document.getElementById('addressGutter');

    if (codeInput && addressGutter) {
        // Initial calculation
        updateAddressGutter();

        // Update on typing
        codeInput.addEventListener('input', updateAddressGutter);
        
        // Update on start address change
        if (startAddrInput) {
            startAddrInput.addEventListener('input', updateAddressGutter);
        }

        // Sync scrolling (Critical for UX!)
        codeInput.addEventListener('scroll', () => {
            addressGutter.scrollTop = codeInput.scrollTop;
        });
    }
    
    // 5. Ready Message
    addLog('8086 Trainer Kit Emulator ready!', 'success');
    addLog('Enter assembly code and click ASSEMBLE', 'info');
});

function addLog(message, type = 'info') {
    const console = document.getElementById('console');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(entry);
    console.scrollTop = console.scrollHeight;
}

async function assembleCode() {
    const code = document.getElementById('codeInput').value;
    const startAddr = document.getElementById('startAddress').value || '1000';
    
    if (!code.trim()) {
        addLog('No code to assemble', 'error');
        return;
    }
    
    try {
        addLog('Assembling...', 'info');
        document.getElementById('topDisplay').textContent = 'MODE: ASSEMBLE | PROCESSING';
        document.getElementById('bottomDisplay').textContent = 'PARSING INSTRUCTIONS...';
        
        const response = await fetch(`${API_BASE}/api/assemble`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ code, startAddress: startAddr })
        });
        
        const data = await response.json();
        
        if (data.success) {
            addLog(`Success! ${data.count} instructions at ${data.startAddress}H`, 'success');
            data.instructions.forEach(instr => {
                addLog(`${instr.address}: ${instr.bytes.padEnd(20)} ${instr.instruction}`, 'info');
            });
            
            document.getElementById('topDisplay').textContent = `MODE: READY | START: ${data.startAddress}H`;
            document.getElementById('bottomDisplay').textContent = 'PRESS RUN TO EXECUTE';
            
            updateRegisters();
            updateMemoryView();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        addLog(`ERROR: ${error.message}`, 'error');
        document.getElementById('topDisplay').textContent = 'MODE: ERROR';
        document.getElementById('bottomDisplay').textContent = error.message.substring(0, 50);
    }
}

async function runProgram() {
    const startAddr = document.getElementById('startAddress').value || '1000';
    
    try {
        isRunning = true;
        addLog('Running program...', 'info');
        document.getElementById('topDisplay').textContent = 'MODE: RUNNING';
        
        const response = await fetch(`${API_BASE}/api/execute`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ startAddress: startAddr, maxSteps: 10000 }) 
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show execution trace
            for (const step of data.trace) {
                addLog(`Exec: ${step.address} | ${step.instruction}`, 'success');
            }
            
            if (data.maxStepsReached) {
                addLog('Execution stopped: Maximum steps reached', 'error');
            } else {
                addLog('Program halted', 'success');
            }
            
            document.getElementById('topDisplay').textContent = 'MODE: HALTED';
            document.getElementById('bottomDisplay').textContent = 'PROGRAM FINISHED';
            
            // Update displays
            updateRegistersFromData(data.registers, data.flags);
            updateMemoryView();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        addLog(`ERROR: ${error.message}`, 'error');
    } finally {
        isRunning = false;
    }
}

async function stepProgram() {
    try {
        const response = await fetch(`${API_BASE}/api/step`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.halted) {
                addLog('Program halted', 'success');
                document.getElementById('topDisplay').textContent = 'MODE: HALTED';
            } else {
                addLog(`Step: ${data.instruction.address} | ${data.instruction.line}`, 'success');
                document.getElementById('topDisplay').textContent = `MODE: STEP | IP: ${data.instruction.address}`;
                document.getElementById('bottomDisplay').textContent = data.instruction.line;
                
                updateRegistersFromData(data.registers, data.flags);
                updateMemoryView();
            }
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        addLog(`ERROR: ${error.message}`, 'error');
    }
}

async function resetEmulator() {
    try {
        const response = await fetch(`${API_BASE}/api/reset`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            addLog('System reset!', 'error');
            document.getElementById('topDisplay').textContent = 'MODE: EDIT | ADDRESS: 0000';
            document.getElementById('bottomDisplay').textContent = 'READY TO ACCEPT INPUT';
            
            updateRegisters();
            updateMemoryView();
        }
    } catch (error) {
        addLog(`ERROR: ${error.message}`, 'error');
    }
}

async function loadPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    // 1. Load Code
    document.getElementById('codeInput').value = preset.code;
    document.getElementById('startAddress').value = preset.startAddr;
    
    // 2. Trigger Gutter Update
    if (typeof updateAddressGutter === 'function') {
        updateAddressGutter();
    }

    // 3. Load Memory Data
    if (preset.memory) {
        try {
            await fetch(`${API_BASE}/api/memory/write`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    address: preset.memory.addr,
                    values: preset.memory.data
                })
            });
            addLog(`Loaded preset: ${name} (Memory initialized)`, 'success');
            // Update view to show the new data
            document.getElementById('memAddr').value = preset.memory.addr;
            updateMemoryView();
        } catch (error) {
            addLog(`Error loading preset data: ${error.message}`, 'error');
        }
    }
}

async function clearMemory() {
    // Safety check so users don't accidentally wipe their data
    if (!confirm("Are you sure you want to clear ALL memory? This cannot be undone.")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/memory/clear`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            addLog('Memory completely cleared', 'success');
            // Refresh the view so they see the zeros immediately
            updateMemoryView();
        }
    } catch (error) {
        addLog(`ERROR: ${error.message}`, 'error');
    }
}

async function updateRegisters() {
    try {
        const response = await fetch(`${API_BASE}/api/registers`);
        const data = await response.json();
        
        if (data.success) {
            updateRegistersFromData(data.registers, data.flags);
        }
    } catch (error) {
        console.error('Error updating registers:', error);
    }
}

function updateRegistersFromData(registers, flags) {
    // Update registers
    Object.entries(registers).forEach(([name, value]) => {
        const el = document.getElementById(`reg-${name.toLowerCase()}`);
        if (el) {
            const valueSpan = el.querySelector('.register-value');
            if (valueSpan) {
                valueSpan.textContent = value;
                // Highlight if changed
                el.classList.add('highlight');
                setTimeout(() => el.classList.remove('highlight'), 800);
            }
        }
    });
    
    // Update flags
    Object.entries(flags).forEach(([name, value]) => {
        const el = document.getElementById(`flag-${name.toLowerCase()}`);
        if (el) {
            el.querySelector('.flag-value').textContent = value;
            el.classList.toggle('set', value === 1);
        }
    });
}

async function updateMemoryView() {
    const addr = document.getElementById('memAddr').value || '2000';
    
    try {
        const response = await fetch(`${API_BASE}/api/memory/read`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: addr, count: 128 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const grid = document.getElementById('memGrid');
            grid.innerHTML = '';
            
            for (let row = 0; row < 8; row++) {
                const rowAddr = parseInt(addr, 16) + (row * 16);
                const rowDiv = document.createElement('div');
                rowDiv.className = 'memory-row';
                
                const addrSpan = document.createElement('span');
                addrSpan.className = 'memory-address';
                addrSpan.textContent = rowAddr.toString(16).toUpperCase().padStart(4, '0') + ':';
                rowDiv.appendChild(addrSpan);
                
                const bytesDiv = document.createElement('div');
                bytesDiv.className = 'memory-bytes';
                
                for (let col = 0; col < 16; col++) {
                    const byteSpan = document.createElement('span');
                    byteSpan.className = 'memory-byte';
                    byteSpan.textContent = data.data[row * 16 + col];
                    bytesDiv.appendChild(byteSpan);
                }
                
                rowDiv.appendChild(bytesDiv);
                grid.appendChild(rowDiv);
            }
        }
    } catch (error) {
        console.error('Error reading memory:', error);
    }
}

// Memory Editor Functions

function showMemoryEditor() {
    document.getElementById('memoryEditorModal').style.display = 'block';
    document.getElementById('memEditStartAddr').value = document.getElementById('memAddr').value || '2000';
}

function closeMemoryEditor() {
    document.getElementById('memoryEditorModal').style.display = 'none';
    document.getElementById('memEditDisplay').style.display = 'none';
}

function startMemoryEdit() {
    const addr = document.getElementById('memEditStartAddr').value;
    currentEditAddress = parseInt(addr, 16);
    
    document.getElementById('memEditDisplay').style.display = 'block';
    document.getElementById('currentEditAddr').textContent = currentEditAddress.toString(16).toUpperCase().padStart(4, '0') + ':';
    document.getElementById('memEditValue').value = '';
    document.getElementById('memEditValue').focus();
    document.getElementById('memEditHistory').innerHTML = '';
}

async function writeMemoryByte() {
    const value = document.getElementById('memEditValue').value.trim();
    
    if (!value || value.length === 0) return;
    
    try {
        const hexValue = parseInt(value, 16);
        if (isNaN(hexValue) || hexValue < 0 || hexValue > 255) {
            addLog('Invalid hex value (00-FF)', 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/memory/write`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                address: currentEditAddress.toString(16),
                values: [hexValue]
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Add to history
            const history = document.getElementById('memEditHistory');
            const entry = document.createElement('div');
            entry.style.color = '#00ff00';
            entry.textContent = `${currentEditAddress.toString(16).toUpperCase().padStart(4, '0')}: ${value.toUpperCase().padStart(2, '0')}`;
            history.appendChild(entry);
            history.scrollTop = history.scrollHeight;
            
            // Move to next address
            currentEditAddress++;
            document.getElementById('currentEditAddr').textContent = currentEditAddress.toString(16).toUpperCase().padStart(4, '0') + ':';
            document.getElementById('memEditValue').value = '';
            document.getElementById('memEditValue').focus();
            
            // Update memory view
            updateMemoryView();
        }
    } catch (error) {
        addLog(`Error writing memory: ${error.message}`, 'error');
    }
}

// --- IDE / Gutter Functions ---

function updateAddressGutter() {
    const codeInput = document.getElementById('codeInput');
    if (!codeInput) return;

    const code = codeInput.value;
    const startAddrHex = document.getElementById('startAddress').value || '1000';
    let currentAddr = parseInt(startAddrHex, 16);
    
    if (isNaN(currentAddr)) currentAddr = 0;

    const lines = code.split('\n');
    let gutterText = '';

    lines.forEach(line => {
        // format current address as hex
        gutterText += currentAddr.toString(16).toUpperCase().padStart(4, '0') + ':\n';
        
        // Calculate size of this line to update address for NEXT line
        const size = estimateInstructionSize(line);
        currentAddr += size;
    });

    const gutter = document.getElementById('addressGutter');
    if (gutter) gutter.textContent = gutterText;
}

function estimateInstructionSize(line) {
    // Remove comments and trim
    line = line.split(';')[0].trim().toUpperCase();
    
    // Empty lines or labels take 0 bytes
    if (!line || line.endsWith(':')) return 0;

    const parts = line.split(/\s+/); // Split by whitespace
    const mnem = parts[0];

    // Simple 1-byte instructions
    if (['HLT', 'NOP', 'RET', 'PUSHF', 'POPF'].includes(mnem)) return 1;

    // INC/DEC
    if (['INC', 'DEC'].includes(mnem) && parts.length > 1) {
        const op = parts[1].replace(/,/g, '');
        const reg16 = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'BP'];
        return reg16.includes(op) ? 1 : 2;
    }

    // Jumps (Assuming Short Jumps for estimation)
    if (mnem === 'JMP' || mnem.startsWith('J') || mnem === 'LOOP') return 2;

    // MOV
    if (mnem === 'MOV') {
        if (line.includes(',')) {
            const args = line.substring(3).replace(/\s/g, '');
            const [dest, src] = args.split(',');
            
            const isReg = ['AX','BX','CX','DX','AL','BL','CL','DL','AH','BH','CH','DH','SI','DI','SP','BP'].includes(src);
            const isPtr = src.startsWith('[') && src.endsWith(']');
            
            if (!isReg && !isPtr && src) {
                // Immediate move
                const dest16 = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'BP'];
                return dest16.includes(dest) ? 3 : 2;
            }
        }
        return 2; 
    }

    return 2;
}