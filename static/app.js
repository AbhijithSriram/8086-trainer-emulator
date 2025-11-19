// API base URL
const API_BASE = '';  // Empty for same origin

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