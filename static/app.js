// API base URL
const API_BASE = '';  // Empty for same origin

// ==========================================
//  PRESET PROGRAMS (Hardcoded for 1000H)
// ==========================================

const PRESETS = {
    // 1. 8-Bit Addition (Stress Test: FF + FF)
    'add8': {
        startAddr: '1000',
        code: `; 8-BIT ADDITION (Stress Test: FF + FF)
; Checks Carry generation
MOV SI, 2000
MOV AL, [SI]      ; Load FF
INC SI
MOV BL, [SI]      ; Load FF
ADD AL, BL        ; Result FE, Carry=1
MOV DL, 00        ; Clear Carry Reg
ADC DL, 00        ; Add Carry to DL
MOV SI, 2002
MOV [SI], AL      ; Store FE
INC SI
MOV [SI], DL      ; Store 01
HLT`,
        memory: { addr: '2000', data: [0xFF, 0xFF] }
    },

    // 2. 8-Bit Subtraction (Stress Test: Borrow)
    'sub8': {
        startAddr: '1000',
        code: `; 8-BIT SUBTRACTION (Stress Test: 05 - 0A)
; Checks Borrow generation
MOV SI, 2000
MOV AL, [SI]      ; Load 05
INC SI
MOV BL, [SI]      ; Load 0A
SUB AL, BL        ; Result FB, Borrow=1
MOV DL, 00
SBB DL, 00        ; Subtract Borrow from DL
MOV SI, 2002
MOV [SI], AL      ; Store Result
INC SI
MOV [SI], DL      ; Store Borrow Status
HLT`,
        memory: { addr: '2000', data: [0x05, 0x0A] }
    },

    // 3. 8-Bit Multiplication & Division
    'muldiv8': {
        startAddr: '1000',
        code: `; 8-BIT MUL & DIV
; 1. Multiply FF * FF (Max 8-bit)
MOV SI, 2000
MOV AL, [SI]
MOV BL, [SI]
MUL BL            ; Result FE01 in AX
MOV SI, 2002
MOV [SI], AX      ; Store FE01
; 2. Divide (F0 / 02)
MOV SI, 2000
MOV AX, 0000      ; Clear AX
MOV AL, 0F0H      ; Load F0
MOV BL, 02
DIV BL            ; AL=78 (Quot), AH=00 (Rem)
MOV SI, 2004
MOV [SI], AL
INC SI
MOV [SI], AH
HLT`,
        memory: { addr: '2000', data: [0xFF] } // FF is used for Mul
    },

    // 4. 16-Bit Addition (ADC Method)
    'add16': {
        startAddr: '1000',
        code: `; 16-BIT ADDITION (ADC Method)
; FFFF + 0001 = 10000
MOV SI, 2000
MOV AX, [SI]      ; Load FFFF
INC SI
INC SI
MOV BX, [SI]      ; Load 0001
ADD AX, BX        ; Sum=0000, Carry=1
MOV DX, 0000
ADC DX, 0000      ; Add Carry to DX
MOV SI, 2004
MOV [SI], AX      ; Store Sum
INC SI
INC SI
MOV [SI], DX      ; Store Carry
HLT`,
        memory: { addr: '2000', data: [0xFF, 0xFF, 0x01, 0x00] }
    },

    // 5. 16-Bit Multiplication
    'mul16': {
        startAddr: '1000',
        code: `; 16-BIT MULTIPLICATION (Max Value)
; FFFF * FFFF = FFFE0001
MOV SI, 2000
MOV AX, [SI]      ; Load FFFF
MOV BX, [SI]      ; Load FFFF
MUL BX            ; DX:AX = Result
MOV SI, 2002
MOV [SI], AX      ; Store Low Word (0001)
INC SI
INC SI
MOV [SI], DX      ; Store High Word (FFFE)
HLT`,
        memory: { addr: '2000', data: [0xFF, 0xFF] }
    },

    // 6. 1s & 2s Complement
    'complements': {
        startAddr: '1000',
        code: `; 1s and 2s COMPLEMENT
MOV SI, 2000
MOV AL, [SI]      ; Load Data (00)
NOT AL            ; 1s Comp (FF)
MOV [SI], AL      ; Store 1s Comp
INC SI
MOV AL, [SI]      ; Load Data (01)
NEG AL            ; 2s Comp (FF)
MOV [SI], AL      ; Store 2s Comp
HLT`,
        memory: { addr: '2000', data: [0x00, 0x01] }
    },

    // 7. Sum of Series (8-Bit) - THE PROFESSOR TEST
    'sum8': {
        startAddr: '1000',
        code: `; SUM OF SERIES (8-BIT)
; The "Professor Proof" Test
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
JNZ 100C          ; Jump back to MOV BL
MOV [SI], AX      ; Store FE01
HLT`,
        // This creates an array [FF, FF, FF....] (256 bytes long)
        memory: { addr: '2000', data: new Array(256).fill(0xFF) }
    },

    // 8. Sum of Series (16-Bit)
    'sum16': {
        startAddr: '1000',
        code: `; SUM OF SERIES (16-BIT)
MOV SI, 2000
MOV CL, [SI]      ; Load Count
MOV AX, 0000      ; Sum Low
MOV DX, 0000      ; Sum High
INC SI
INC SI
; Loop starts at 100B
ADD AX, [SI]      ; Add Number
JNC 1010          ; Skip carry inc
INC DX            ; Handle Carry
INC SI            ; Move SI (Low)
INC SI            ; Move SI (High)
DEC CL
JNZ 100B          ; Loop
MOV [SI], AX      ; Store Low
INC SI
INC SI
MOV [SI], DX      ; Store High
HLT`,
        memory: { addr: '2000', data: [0x03, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0x02, 0x00] }
    },

    // 9. Largest Number in Array
    'largest': {
        startAddr: '1000',
        code: `; FIND LARGEST NUMBER
; Array: 05, 01, 99, FF, 02
MOV SI, 2000
MOV CL, [SI]      ; Count
INC SI
MOV AL, [SI]      ; Init Max
DEC CL
; Loop starts at 100A
INC SI
CMP AL, [SI]
JNB 1011          ; Skip if Max >= Next
MOV AL, [SI]      ; Update Max
DEC CL
JNZ 100A          ; Loop
MOV DI, 3000
MOV [DI], AL      ; Result at 3000
HLT`,
        memory: { addr: '2000', data: [0x05, 0x01, 0x99, 0xFF, 0x02, 0x10] }
    },

    // 10. Sorting (Ascending)
    'sort': {
        startAddr: '1000',
        code: `; SORT ARRAY (ASCENDING)
; Input: 04, FF, 10, 80, 00
MOV SI, 1300
MOV CL, [SI]      ; Outer Count
; Outer Loop (1005)
MOV SI, 1300
MOV DL, [SI]      ; Inner Count
INC SI
MOV AL, [SI]      ; Load Current
DEC DL
JZ 1022           ; -> NEXT_PASS
; Inner Loop (100E)
INC SI
MOV BL, [SI]      ; Load Next
CMP AL, BL
JNB 101A          ; -> NOSWAP
DEC SI            ; Swap Logic
MOV [SI], AL
MOV AL, BL
JMP 101D          ; -> CONT
; NOSWAP (101A)
DEC SI
MOV [SI], BL
INC SI
; CONT (101D)
DEC DL
JNZ 100E          ; -> Inner Loop
; NEXT_PASS (1022)
MOV [SI], AL
DEC CL
JNZ 1005          ; -> Outer Loop
HLT`,
        memory: { addr: '1300', data: [0x04, 0xFF, 0x10, 0x80, 0x00] }
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