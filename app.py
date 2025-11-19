from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
import secrets
import json

from emulator import Memory, Registers, Assembler, Executor

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
CORS(app)

emulator_sessions = {}


def get_emulator(session_id):
    """Get or create emulator instance for session"""
    if session_id not in emulator_sessions:
        emulator_sessions[session_id] = {
            'memory': Memory(),
            'registers': Registers(),
            'assembler': Assembler(),
            'executor': None,
            'instructions': []
        }
    return emulator_sessions[session_id]


@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')


@app.route('/api/assemble', methods=['POST'])
def assemble():
    """Assemble code endpoint"""
    try:
        data = request.json
        code = data.get('code', '')
        start_addr = int(data.get('startAddress', '1000'), 16)
        session_id = session.get('session_id', secrets.token_hex(16))
        session['session_id'] = session_id
        
        emu = get_emulator(session_id)
        asm = emu['assembler']
        asm.start_addr = start_addr
        
        # Parse code
        instructions = asm.parse(code)
        machine_code = asm.get_machine_code()
        
        # Create executor and load
        emu['executor'] = Executor(emu['memory'], emu['registers'])
        emu['executor'].load(instructions)
        emu['instructions'] = instructions
        
        # Format response
        assembled = []
        for addr, bytes_list, line in machine_code:
            assembled.append({
                'address': f'{addr:04X}',
                'bytes': ' '.join(f'{b:02X}' for b in bytes_list),
                'instruction': line
            })
        
        return jsonify({
            'success': True,
            'instructions': assembled,
            'startAddress': f'{start_addr:04X}',
            'count': len(instructions)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/execute', methods=['POST'])
def execute():
    """Execute program endpoint"""
    try:
        data = request.json
        start_addr = int(data.get('startAddress', '1000'), 16)
        max_steps = data.get('maxSteps', 10000)
        session_id = session.get('session_id')
        
        if not session_id or session_id not in emulator_sessions:
            return jsonify({
                'success': False,
                'error': 'No code assembled. Please assemble first.'
            }), 400
        
        emu = get_emulator(session_id)
        executor = emu['executor']
        
        if not executor or not executor.instructions:
            return jsonify({
                'success': False,
                'error': 'No instructions loaded'
            }), 400
        
        # Find start instruction
        found = False
        for i, instr in enumerate(executor.instructions):
            if instr.addr == start_addr:
                executor.idx = i
                found = True
                break
        
        if not found:
            return jsonify({
                'success': False,
                'error': f'No instruction at address {start_addr:04X}'
            }), 400
        
        # Execute
        executor.halted = False
        execution_trace = []
        step_count = 0
        
        while not executor.halted and step_count < max_steps:
            instr = executor.step()
            if instr is None:
                break
            
            execution_trace.append({
                'address': f'{instr.addr:04X}',
                'instruction': instr.line
            })
            step_count += 1
        
        # Get final state
        registers = {
            'AX': f'{emu["registers"].AX:04X}',
            'BX': f'{emu["registers"].BX:04X}',
            'CX': f'{emu["registers"].CX:04X}',
            'DX': f'{emu["registers"].DX:04X}',
            'SI': f'{emu["registers"].SI:04X}',
            'DI': f'{emu["registers"].DI:04X}',
            'IP': f'{emu["registers"].IP:04X}',
            'SP': f'{emu["registers"].SP:04X}',
        }
        
        flags = {
            'CF': emu["registers"].flags['CF'],
            'ZF': emu["registers"].flags['ZF'],
            'SF': emu["registers"].flags['SF'],
            'OF': emu["registers"].flags['OF'],
            'PF': emu["registers"].flags['PF'],
        }
        
        return jsonify({
            'success': True,
            'trace': execution_trace,
            'registers': registers,
            'flags': flags,
            'halted': executor.halted,
            'steps': step_count,
            'maxStepsReached': step_count >= max_steps
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/step', methods=['POST'])
def step():
    """Execute single step endpoint"""
    try:
        session_id = session.get('session_id')
        
        if not session_id or session_id not in emulator_sessions:
            return jsonify({
                'success': False,
                'error': 'No code assembled'
            }), 400
        
        emu = get_emulator(session_id)
        executor = emu['executor']
        
        if not executor:
            return jsonify({
                'success': False,
                'error': 'No executor initialized'
            }), 400
        
        if executor.halted:
            return jsonify({
                'success': False,
                'error': 'Program already halted'
            }), 400
        
        instr = executor.step()
        
        if instr is None:
            return jsonify({
                'success': True,
                'halted': True
            })
        
        registers = {
            'AX': f'{emu["registers"].AX:04X}',
            'BX': f'{emu["registers"].BX:04X}',
            'CX': f'{emu["registers"].CX:04X}',
            'DX': f'{emu["registers"].DX:04X}',
            'SI': f'{emu["registers"].SI:04X}',
            'DI': f'{emu["registers"].DI:04X}',
            'IP': f'{emu["registers"].IP:04X}',
            'SP': f'{emu["registers"].SP:04X}',
        }
        
        flags = {
            'CF': emu["registers"].flags['CF'],
            'ZF': emu["registers"].flags['ZF'],
            'SF': emu["registers"].flags['SF'],
            'OF': emu["registers"].flags['OF'],
            'PF': emu["registers"].flags['PF'],
        }
        
        return jsonify({
            'success': True,
            'instruction': {
                'address': f'{instr.addr:04X}',
                'line': instr.line
            },
            'registers': registers,
            'flags': flags,
            'halted': executor.halted
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/memory/read', methods=['POST'])
def read_memory():
    """Read memory range endpoint"""
    try:
        data = request.json
        start_addr = int(data.get('address', '2000'), 16)
        count = data.get('count', 128)
        session_id = session.get('session_id')
        
        if not session_id or session_id not in emulator_sessions:
            # Return empty memory if no session
            return jsonify({
                'success': True,
                'address': f'{start_addr:04X}',
                'data': ['00'] * count
            })
        
        emu = get_emulator(session_id)
        memory_data = []
        
        for i in range(count):
            value = emu['memory'].read(start_addr + i)
            memory_data.append(f'{value:02X}')
        
        return jsonify({
            'success': True,
            'address': f'{start_addr:04X}',
            'data': memory_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/memory/write', methods=['POST'])
def write_memory():
    """Write to memory endpoint"""
    try:
        data = request.json
        address = int(data.get('address', '2000'), 16)
        values = data.get('values', [])
        session_id = session.get('session_id', secrets.token_hex(16))
        session['session_id'] = session_id
        
        emu = get_emulator(session_id)
        
        for i, value in enumerate(values):
            if isinstance(value, str):
                value = int(value, 16)
            emu['memory'].write(address + i, value)
        
        return jsonify({
            'success': True,
            'written': len(values)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/reset', methods=['POST'])
def reset():
    """Reset emulator endpoint"""
    try:
        session_id = session.get('session_id')
        
        if session_id and session_id in emulator_sessions:
            emu = emulator_sessions[session_id]
            # Reset registers but keep memory
            emu['registers'] = Registers()
            emu['executor'] = None
            emu['instructions'] = []
        
        return jsonify({
            'success': True,
            'message': 'Emulator reset'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@app.route('/api/registers', methods=['GET'])
def get_registers():
    """Get current register values"""
    try:
        session_id = session.get('session_id')
        
        if not session_id or session_id not in emulator_sessions:
            # Return default registers
            default_regs = Registers()
            registers = {
                'AX': '0000', 'BX': '0000', 'CX': '0000', 'DX': '0000',
                'SI': '0000', 'DI': '0000', 'IP': '0000', 'SP': 'FFFE'
            }
            flags = {'CF': 0, 'ZF': 0, 'SF': 0, 'OF': 0, 'PF': 0}
        else:
            emu = get_emulator(session_id)
            registers = {
                'AX': f'{emu["registers"].AX:04X}',
                'BX': f'{emu["registers"].BX:04X}',
                'CX': f'{emu["registers"].CX:04X}',
                'DX': f'{emu["registers"].DX:04X}',
                'SI': f'{emu["registers"].SI:04X}',
                'DI': f'{emu["registers"].DI:04X}',
                'IP': f'{emu["registers"].IP:04X}',
                'SP': f'{emu["registers"].SP:04X}',
            }
            flags = emu["registers"].flags
        
        return jsonify({
            'success': True,
            'registers': registers,
            'flags': flags
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)