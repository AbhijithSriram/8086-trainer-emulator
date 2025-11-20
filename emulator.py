import re
import sys
from typing import Dict, List, Tuple, Optional

class Memory:
    """1MB Memory"""
    def __init__(self):
        self.data = bytearray(0x100000)

    def clear(self):
        """Clear all memory"""
        self.data = bytearray(0x100000)
    
    def read(self, addr: int) -> int:
        return self.data[addr & 0xFFFFF]
    
    def write(self, addr: int, value: int):
        self.data[addr & 0xFFFFF] = value & 0xFF
    
    def read_word(self, addr: int) -> int:
        """Read 16-bit word (little endian)"""
        low = self.read(addr)
        high = self.read(addr + 1)
        return (high << 8) | low
    
    def write_word(self, addr: int, value: int):
        """Write 16-bit word (little endian)"""
        self.write(addr, value & 0xFF)
        self.write(addr + 1, (value >> 8) & 0xFF)


class Registers:
    """8086 Registers"""
    def __init__(self):
        self.AX = 0
        self.BX = 0
        self.CX = 0
        self.DX = 0
        self.SI = 0
        self.DI = 0
        self.IP = 0
        self.SP = 0xFFFE
        self.flags = {'CF': 0, 'ZF': 0, 'SF': 0, 'OF': 0, 'PF': 0}
    
    @property
    def AL(self): return self.AX & 0xFF
    @AL.setter
    def AL(self, v): self.AX = (self.AX & 0xFF00) | (v & 0xFF)
    
    @property
    def AH(self): return (self.AX >> 8) & 0xFF
    @AH.setter
    def AH(self, v): self.AX = (self.AX & 0x00FF) | ((v & 0xFF) << 8)
    
    @property
    def BL(self): return self.BX & 0xFF
    @BL.setter
    def BL(self, v): self.BX = (self.BX & 0xFF00) | (v & 0xFF)
    
    @property
    def BH(self): return (self.BX >> 8) & 0xFF
    @BH.setter
    def BH(self, v): self.BX = (self.BX & 0x00FF) | ((v & 0xFF) << 8)
    
    @property
    def CL(self): return self.CX & 0xFF
    @CL.setter
    def CL(self, v): self.CX = (self.CX & 0xFF00) | (v & 0xFF)
    
    @property
    def CH(self): return (self.CX >> 8) & 0xFF
    @CH.setter
    def CH(self, v): self.CX = (self.CX & 0x00FF) | ((v & 0xFF) << 8)
    
    @property
    def DL(self): return self.DX & 0xFF
    @DL.setter
    def DL(self, v): self.DX = (self.DX & 0xFF00) | (v & 0xFF)
    
    @property
    def DH(self): return (self.DX >> 8) & 0xFF
    @DH.setter
    def DH(self, v): self.DX = (self.DX & 0x00FF) | ((v & 0xFF) << 8)
    
    def update_flags(self, result: int, size: int = 8):
        """Update flags after arithmetic operation"""
        mask = 0xFF if size == 8 else 0xFFFF
        sign_bit = 0x80 if size == 8 else 0x8000
        
        self.flags['ZF'] = 1 if (result & mask) == 0 else 0
        self.flags['SF'] = 1 if (result & sign_bit) != 0 else 0
        self.flags['PF'] = 1 if bin(result & 0xFF).count('1') % 2 == 0 else 0


class Instruction:
    """Represents a parsed instruction"""
    def __init__(self, addr: int, mnem: str, ops: str, size: int, 
                 bytes_code: List[int], imm_val=None, line: str = ""):
        self.addr = addr
        self.mnem = mnem
        self.ops = ops
        self.size = size
        self.bytes = bytes_code
        self.imm_val = imm_val
        self.line = line


class Assembler:
    """8086 Assembler"""
    def __init__(self):
        self.instructions: List[Instruction] = []
        self.labels: Dict[str, int] = {}
        self.start_addr = 0x1000
    
    def parse(self, code: str) -> List[Instruction]:
        """Parse assembly code into instructions"""
        self.instructions = []
        self.labels = {}
        
        lines = code.strip().split('\n')
        addr = self.start_addr
        
        # First pass: collect labels and instructions
        for line_num, line in enumerate(lines, 1):
            # Remove comments
            line = line.split(';')[0].strip()
            if not line:
                continue
            
            # Check for label
            if line.endswith(':'):
                label = line[:-1].strip().upper()
                self.labels[label] = addr
                continue
            
            # Parse instruction
            instr = self._parse_instruction(line, addr, line_num)
            if instr:
                self.instructions.append(instr)
                addr += instr.size
        
        # Second pass: resolve labels
        self._resolve_labels()
        
        return self.instructions
    
    def _parse_instruction(self, line: str, addr: int, line_num: int) -> Optional[Instruction]:
        """Parse single instruction"""
        parts = line.split(None, 1)
        if not parts:
            return None
        
        mnem = parts[0].upper()
        ops = parts[1].upper().replace(' ', '') if len(parts) > 1 else ''
        
        size = 0
        bytes_code = []
        imm_val = None
        
        # MOV instructions
        if mnem == 'MOV':
            if ',' not in ops:
                raise SyntaxError(f"Line {line_num}: MOV needs two operands")
            
            dest, src = ops.split(',', 1)
            
            # MOV reg, immediate
            if self._is_hex(src):
                imm_val = int(src, 16)
                if dest == 'SI': bytes_code, size = [0xBE], 3
                elif dest == 'DI': bytes_code, size = [0xBF], 3
                elif dest == 'AX': bytes_code, size = [0xB8], 3
                elif dest == 'BX': bytes_code, size = [0xBB], 3
                elif dest == 'CX': bytes_code, size = [0xB9], 3
                elif dest == 'DX': bytes_code, size = [0xBA], 3
                elif dest == 'AL': bytes_code, size = [0xB0], 2
                elif dest == 'BL': bytes_code, size = [0xB3], 2
                elif dest == 'CL': bytes_code, size = [0xB1], 2
                elif dest == 'DL': bytes_code, size = [0xB2], 2
                elif dest == 'AH': bytes_code, size = [0xB4], 2
                elif dest == 'BH': bytes_code, size = [0xB7], 2
                elif dest == 'CH': bytes_code, size = [0xB5], 2
                elif dest == 'DH': bytes_code, size = [0xB6], 2
                else:
                    raise SyntaxError(f"Line {line_num}: Unknown MOV destination {dest}")
            
            # MOV reg, [SI/DI]
            elif src in ['[SI]', '[DI]']:
                # 8-bit destinations
                if dest == 'AL': bytes_code, size = [0x8A, 0x04 if src == '[SI]' else 0x05], 2
                elif dest == 'BL': bytes_code, size = [0x8A, 0x1C if src == '[SI]' else 0x1D], 2
                elif dest == 'CL': bytes_code, size = [0x8A, 0x0C if src == '[SI]' else 0x0D], 2
                elif dest == 'DL': bytes_code, size = [0x8A, 0x14 if src == '[SI]' else 0x15], 2
                # 16-bit destinations (Added BX, CX, DX support)
                elif dest == 'AX': bytes_code, size = [0x8B, 0x04 if src == '[SI]' else 0x05], 2
                elif dest == 'BX': bytes_code, size = [0x8B, 0x1C if src == '[SI]' else 0x1D], 2
                elif dest == 'CX': bytes_code, size = [0x8B, 0x0C if src == '[SI]' else 0x0D], 2
                elif dest == 'DX': bytes_code, size = [0x8B, 0x14 if src == '[SI]' else 0x15], 2
                else:
                    raise SyntaxError(f"Line {line_num}: Unsupported MOV {dest}, {src}")
            
            # MOV [SI/DI], reg
            elif dest in ['[SI]', '[DI]']:
                # 8-bit sources (Low Bytes)
                if src == 'AL': bytes_code, size = [0x88, 0x04 if dest == '[SI]' else 0x05], 2
                elif src == 'CL': bytes_code, size = [0x88, 0x0C if dest == '[SI]' else 0x0D], 2
                elif src == 'DL': bytes_code, size = [0x88, 0x14 if dest == '[SI]' else 0x15], 2
                elif src == 'BL': bytes_code, size = [0x88, 0x1C if dest == '[SI]' else 0x1D], 2
                
                # 8-bit sources (High Bytes) - THIS WAS MISSING
                elif src == 'AH': bytes_code, size = [0x88, 0x24 if dest == '[SI]' else 0x25], 2
                elif src == 'CH': bytes_code, size = [0x88, 0x2C if dest == '[SI]' else 0x2D], 2
                elif src == 'DH': bytes_code, size = [0x88, 0x34 if dest == '[SI]' else 0x35], 2
                elif src == 'BH': bytes_code, size = [0x88, 0x3C if dest == '[SI]' else 0x3D], 2
                
                # 16-bit sources
                elif src == 'AX': bytes_code, size = [0x89, 0x04 if dest == '[SI]' else 0x05], 2
                elif src == 'CX': bytes_code, size = [0x89, 0x0C if dest == '[SI]' else 0x0D], 2
                elif src == 'DX': bytes_code, size = [0x89, 0x14 if dest == '[SI]' else 0x15], 2
                elif src == 'BX': bytes_code, size = [0x89, 0x1C if dest == '[SI]' else 0x1D], 2
                elif src == 'SP': bytes_code, size = [0x89, 0x24 if dest == '[SI]' else 0x25], 2
                elif src == 'BP': bytes_code, size = [0x89, 0x2C if dest == '[SI]' else 0x2D], 2
                elif src == 'SI': bytes_code, size = [0x89, 0x34 if dest == '[SI]' else 0x35], 2
                elif src == 'DI': bytes_code, size = [0x89, 0x3C if dest == '[SI]' else 0x3D], 2
                else:
                    raise SyntaxError(f"Line {line_num}: Unsupported MOV {dest}, {src}")
                
            # MOV reg, reg (Universal Fix)
            else:
                # 8-bit Move (AL, BL, CL, DL, AH, BH, CH, DH)
                if dest.endswith('L') or dest.endswith('H'):
                     # We use dummy opcode 88 C0 for the display, but execution works fine
                     bytes_code, size = [0x88, 0xC0], 2
                # 16-bit Move (AX, BX, CX, DX, SI, DI, SP, BP)
                else:
                     bytes_code, size = [0x89, 0xC0], 2
        
        # ADD
        elif mnem == 'ADD':
            dest, src = ops.split(',', 1)
            # 1. ADD reg, [SI] or [DI] (Memory) <-- NEW!
            if src in ['[SI]', '[DI]']:
                if dest == 'AL': bytes_code, size = [0x02, 0x04 if src == '[SI]' else 0x05], 2
                elif dest == 'AX': bytes_code, size = [0x03, 0x04 if src == '[SI]' else 0x05], 2
                else: raise SyntaxError(f"Line {line_num}: ADD memory only supported for AL/AX")
            # 2. ADD reg, reg
            elif dest == 'AL' and src == 'BL': bytes_code, size = [0x00, 0xD8], 2
            elif dest == 'AX' and src == 'BX': bytes_code, size = [0x01, 0xD8], 2
            # 3. ADD reg, immediate
            elif dest == 'AL' and self._is_hex(src):
                imm_val = int(src, 16)
                bytes_code, size = [0x04], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported ADD {ops}")

        # SUB
        elif mnem == 'SUB':
            dest, src = ops.split(',', 1)
            # 1. SUB reg, [SI] or [DI] (Memory) <-- NEW!
            if src in ['[SI]', '[DI]']:
                if dest == 'AL': bytes_code, size = [0x2A, 0x04 if src == '[SI]' else 0x05], 2
                elif dest == 'AX': bytes_code, size = [0x2B, 0x04 if src == '[SI]' else 0x05], 2
                else: raise SyntaxError(f"Line {line_num}: SUB memory only supported for AL/AX")
            # 2. SUB reg, reg
            elif dest == 'AL' and src == 'BL': bytes_code, size = [0x28, 0xD8], 2
            elif dest == 'AX' and src == 'BX': bytes_code, size = [0x29, 0xD8], 2
            # 3. SUB reg, immediate
            elif dest == 'AL' and self._is_hex(src):
                imm_val = int(src, 16)
                bytes_code, size = [0x2C], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported SUB {ops}")
            
        # ADC (Add with Carry)
        elif mnem == 'ADC':
            dest, src = ops.split(',', 1)
            # ADC reg, immediate
            if self._is_hex(src):
                imm_val = int(src, 16)
                if dest in ['AL','BL','CL','DL','AH','BH','CH','DH']: bytes_code, size = [0x80, 0xD0], 2
                else: bytes_code, size = [0x81, 0xD0], 4
            # ADC reg, reg
            else:
                if (dest.endswith('L') or dest.endswith('H')): bytes_code, size = [0x10, 0xC0], 2
                else: bytes_code, size = [0x11, 0xC0], 2

        # SBB (Subtract with Borrow)
        elif mnem == 'SBB':
            dest, src = ops.split(',', 1)
            # SBB reg, immediate
            if self._is_hex(src):
                imm_val = int(src, 16)
                if dest in ['AL','BL','CL','DL','AH','BH','CH','DH']: bytes_code, size = [0x80, 0xD8], 2
                else: bytes_code, size = [0x81, 0xD8], 4
            # SBB reg, reg
            else:
                if (dest.endswith('L') or dest.endswith('H')): bytes_code, size = [0x18, 0xC0], 2
                else: bytes_code, size = [0x19, 0xC0], 2

        # MUL
        elif mnem == 'MUL':
            if ops == 'BL': bytes_code, size = [0xF6, 0xE3], 2
            elif ops == 'BX': bytes_code, size = [0xF7, 0xE3], 2
            elif ops == 'CL': bytes_code, size = [0xF6, 0xE1], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported MUL {ops}")
        
        # DIV
        elif mnem == 'DIV':
            if ops == 'BL': bytes_code, size = [0xF6, 0xF3], 2
            elif ops == 'BX': bytes_code, size = [0xF7, 0xF3], 2
            elif ops == 'CL': bytes_code, size = [0xF6, 0xF1], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported DIV {ops}")
        
        # INC
        elif mnem == 'INC':
            # 16-bit Registers
            if ops == 'AX': bytes_code, size = [0x40], 1
            elif ops == 'CX': bytes_code, size = [0x41], 1
            elif ops == 'DX': bytes_code, size = [0x42], 1
            elif ops == 'BX': bytes_code, size = [0x43], 1
            elif ops == 'SP': bytes_code, size = [0x44], 1
            elif ops == 'BP': bytes_code, size = [0x45], 1
            elif ops == 'SI': bytes_code, size = [0x46], 1
            elif ops == 'DI': bytes_code, size = [0x47], 1
            # 8-bit Registers (These were missing!)
            elif ops == 'AL': bytes_code, size = [0xFE, 0xC0], 2
            elif ops == 'CL': bytes_code, size = [0xFE, 0xC1], 2
            elif ops == 'DL': bytes_code, size = [0xFE, 0xC2], 2
            elif ops == 'BL': bytes_code, size = [0xFE, 0xC3], 2
            elif ops == 'AH': bytes_code, size = [0xFE, 0xC4], 2
            elif ops == 'CH': bytes_code, size = [0xFE, 0xC5], 2
            elif ops == 'DH': bytes_code, size = [0xFE, 0xC6], 2
            elif ops == 'BH': bytes_code, size = [0xFE, 0xC7], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported INC {ops}")
        
        # DEC
        elif mnem == 'DEC':
            # 16-bit Registers (1 Byte)
            if ops == 'AX': bytes_code, size = [0x48], 1
            elif ops == 'CX': bytes_code, size = [0x49], 1
            elif ops == 'DX': bytes_code, size = [0x4A], 1
            elif ops == 'BX': bytes_code, size = [0x4B], 1
            elif ops == 'SP': bytes_code, size = [0x4C], 1
            elif ops == 'BP': bytes_code, size = [0x4D], 1
            elif ops == 'SI': bytes_code, size = [0x4E], 1
            elif ops == 'DI': bytes_code, size = [0x4F], 1
            # 8-bit Registers (2 Bytes)
            elif ops == 'AL': bytes_code, size = [0xFE, 0xC8], 2
            elif ops == 'CL': bytes_code, size = [0xFE, 0xC9], 2
            elif ops == 'DL': bytes_code, size = [0xFE, 0xCA], 2
            elif ops == 'BL': bytes_code, size = [0xFE, 0xCB], 2
            elif ops == 'AH': bytes_code, size = [0xFE, 0xCC], 2
            elif ops == 'CH': bytes_code, size = [0xFE, 0xCD], 2
            elif ops == 'DH': bytes_code, size = [0xFE, 0xCE], 2
            elif ops == 'BH': bytes_code, size = [0xFE, 0xCF], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported DEC {ops}")
            
        # DEC
        elif mnem == 'DEC':
            # 16-bit Registers (1 Byte)
            if ops == 'AX': bytes_code, size = [0x48], 1
            elif ops == 'CX': bytes_code, size = [0x49], 1
            elif ops == 'DX': bytes_code, size = [0x4A], 1
            elif ops == 'BX': bytes_code, size = [0x4B], 1
            elif ops == 'SP': bytes_code, size = [0x4C], 1
            elif ops == 'BP': bytes_code, size = [0x4D], 1
            elif ops == 'SI': bytes_code, size = [0x4E], 1
            elif ops == 'DI': bytes_code, size = [0x4F], 1
            # 8-bit Registers (2 Bytes)
            elif ops == 'AL': bytes_code, size = [0xFE, 0xC8], 2
            elif ops == 'CL': bytes_code, size = [0xFE, 0xC9], 2
            elif ops == 'DL': bytes_code, size = [0xFE, 0xCA], 2
            elif ops == 'BL': bytes_code, size = [0xFE, 0xCB], 2
            elif ops == 'AH': bytes_code, size = [0xFE, 0xCC], 2
            elif ops == 'CH': bytes_code, size = [0xFE, 0xCD], 2
            elif ops == 'DH': bytes_code, size = [0xFE, 0xCE], 2
            elif ops == 'BH': bytes_code, size = [0xFE, 0xCF], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported DEC {ops}")

        # CMP
        elif mnem == 'CMP':
            dest, src = ops.split(',', 1)
            
            # 1. CMP reg, [SI] or [DI]
            if src in ['[SI]', '[DI]']:
                if dest == 'AL': bytes_code, size = [0x3A, 0x04 if src == '[SI]' else 0x05], 2
                elif dest == 'AX': bytes_code, size = [0x3B, 0x04 if src == '[SI]' else 0x05], 2
                elif dest == 'BL': bytes_code, size = [0x3A, 0x1C if src == '[SI]' else 0x1D], 2
                elif dest == 'BX': bytes_code, size = [0x3B, 0x1C if src == '[SI]' else 0x1D], 2
                elif dest == 'CL': bytes_code, size = [0x3A, 0x0C if src == '[SI]' else 0x0D], 2
                elif dest == 'CX': bytes_code, size = [0x3B, 0x0C if src == '[SI]' else 0x0D], 2
                elif dest == 'DL': bytes_code, size = [0x3A, 0x14 if src == '[SI]' else 0x15], 2
                elif dest == 'DX': bytes_code, size = [0x3B, 14 if src == '[SI]' else 0x15], 2
                else:
                    # Fallback
                    bytes_code, size = [0x3A, 0x00], 2

            # 2. CMP reg, Immediate (e.g., CMP AL, 09)
            elif self._is_hex(src):
                imm_val = int(src, 16)
                # 8-bit Register check
                if dest in ['AL','BL','CL','DL','AH','BH','CH','DH']:
                     bytes_code, size = [0x80, 0xF8], 2
                # 16-bit Register check
                else:
                     bytes_code, size = [0x81, 0xF8], 4

            # 3. CMP reg, reg
            else:
                if (dest.endswith('L') or dest.endswith('H')) and (src.endswith('L') or src.endswith('H')):
                     bytes_code, size = [0x38, 0xC0], 2
                else:
                     bytes_code, size = [0x39, 0xC0], 2
                        
        # Jumps
        elif mnem in ['JMP', 'JNZ', 'JZ', 'JNB', 'JNA', 'JA', 'JB', 'JG', 'JL', 'JGE', 'JLE']:
            # Can be label or hex address
            imm_val = ops if not self._is_hex(ops) else int(ops, 16)
            
            # All jumps use 2-byte short jump format
            # If the jump is too far (>127 bytes), we'll get an error during code generation
            if mnem == 'JMP': bytes_code, size = [0xEB], 2  # Short jump
            elif mnem == 'JNZ': bytes_code, size = [0x75], 2
            elif mnem == 'JZ': bytes_code, size = [0x74], 2
            elif mnem == 'JNB': bytes_code, size = [0x73], 2
            elif mnem == 'JNA': bytes_code, size = [0x76], 2
            elif mnem == 'JA': bytes_code, size = [0x77], 2
            elif mnem == 'JB': bytes_code, size = [0x72], 2
            elif mnem == 'JG': bytes_code, size = [0x7F], 2
            elif mnem == 'JL': bytes_code, size = [0x7C], 2
            elif mnem == 'JGE': bytes_code, size = [0x7D], 2
            elif mnem == 'JLE': bytes_code, size = [0x7E], 2
        
        # LOOP
        elif mnem == 'LOOP':
            imm_val = ops if not self._is_hex(ops) else int(ops, 16)
            bytes_code, size = [0xE2], 2
        
        # HLT
        elif mnem == 'HLT':
            bytes_code, size = [0xF4], 1
        
        # NOP
        elif mnem == 'NOP':
            bytes_code, size = [0x90], 1
        
        # NOT (1's Complement)
        elif mnem == 'NOT':
            if ops == 'AL': bytes_code, size = [0xF6, 0xD0], 2
            elif ops == 'CL': bytes_code, size = [0xF6, 0xD1], 2
            elif ops == 'DL': bytes_code, size = [0xF6, 0xD2], 2
            elif ops == 'BL': bytes_code, size = [0xF6, 0xD3], 2
            elif ops == 'AH': bytes_code, size = [0xF6, 0xD4], 2
            elif ops == 'CH': bytes_code, size = [0xF6, 0xD5], 2
            elif ops == 'DH': bytes_code, size = [0xF6, 0xD6], 2
            elif ops == 'BH': bytes_code, size = [0xF6, 0xD7], 2
            elif ops == 'AX': bytes_code, size = [0xF7, 0xD0], 2
            elif ops == 'CX': bytes_code, size = [0xF7, 0xD1], 2
            elif ops == 'DX': bytes_code, size = [0xF7, 0xD2], 2
            elif ops == 'BX': bytes_code, size = [0xF7, 0xD3], 2
            elif ops == 'SP': bytes_code, size = [0xF7, 0xD4], 2
            elif ops == 'BP': bytes_code, size = [0xF7, 0xD5], 2
            elif ops == 'SI': bytes_code, size = [0xF7, 0xD6], 2
            elif ops == 'DI': bytes_code, size = [0xF7, 0xD7], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported NOT {ops}")

        # NEG (2's Complement)
        elif mnem == 'NEG':
            if ops == 'AL': bytes_code, size = [0xF6, 0xD8], 2
            elif ops == 'CL': bytes_code, size = [0xF6, 0xD9], 2
            elif ops == 'DL': bytes_code, size = [0xF6, 0xDA], 2
            elif ops == 'BL': bytes_code, size = [0xF6, 0xDB], 2
            elif ops == 'AH': bytes_code, size = [0xF6, 0xDC], 2
            elif ops == 'CH': bytes_code, size = [0xF6, 0xDD], 2
            elif ops == 'DH': bytes_code, size = [0xF6, 0xDE], 2
            elif ops == 'BH': bytes_code, size = [0xF6, 0xDF], 2
            elif ops == 'AX': bytes_code, size = [0xF7, 0xD8], 2
            elif ops == 'CX': bytes_code, size = [0xF7, 0xD9], 2
            elif ops == 'DX': bytes_code, size = [0xF7, 0xDA], 2
            elif ops == 'BX': bytes_code, size = [0xF7, 0xDB], 2
            elif ops == 'SP': bytes_code, size = [0xF7, 0xDC], 2
            elif ops == 'BP': bytes_code, size = [0xF7, 0xDD], 2
            elif ops == 'SI': bytes_code, size = [0xF7, 0xDE], 2
            elif ops == 'DI': bytes_code, size = [0xF7, 0xDF], 2
            else:
                raise SyntaxError(f"Line {line_num}: Unsupported NEG {ops}")
        
        # AND Logic
        elif mnem == 'AND':
            dest, src = ops.split(',', 1)
            # AND reg, immediate (Limited support for Lab examples)
            if dest == 'AL' and self._is_hex(src): 
                imm_val = int(src, 16); bytes_code, size = [0x24], 2
            elif dest == 'AX' and self._is_hex(src): 
                imm_val = int(src, 16); bytes_code, size = [0x25], 3
            # AND reg, reg (Basic support)
            elif dest == 'AX' and src == 'BX': bytes_code, size = [0x21, 0xD8], 2
            elif dest == 'AL' and src == 'BL': bytes_code, size = [0x20, 0xD8], 2
            else: raise SyntaxError(f"Line {line_num}: Simplified AND only supports AL/AX with Hex or BX/BL")

        # OR Logic
        elif mnem == 'OR':
            dest, src = ops.split(',', 1)
            if dest == 'AL' and self._is_hex(src): 
                imm_val = int(src, 16); bytes_code, size = [0x0C], 2
            else: raise SyntaxError(f"Line {line_num}: Simplified OR only supports AL, Imm")

        # XOR Logic
        elif mnem == 'XOR':
            dest, src = ops.split(',', 1)
            if dest == 'AX' and src == 'AX': bytes_code, size = [0x31, 0xC0], 2 # Clear reg
            else: raise SyntaxError(f"Line {line_num}: Simplified XOR only supports XOR AX, AX")

        # SHL (Shift Left) - Lab Manual uses "SHL AL, 01"
        elif mnem == 'SHL':
            dest, count = ops.split(',', 1)
            if count.strip() != '01': raise SyntaxError("SHL only supports shift by 01")
            if dest == 'AL': bytes_code, size = [0xD0, 0xE0], 2
            elif dest == 'AX': bytes_code, size = [0xD1, 0xE0], 2
            else: raise SyntaxError(f"Line {line_num}: Unsupported SHL dest")

        # SHR (Shift Right)
        elif mnem == 'SHR':
            dest, count = ops.split(',', 1)
            if count.strip() != '01': raise SyntaxError("SHR only supports shift by 01")
            if dest == 'AL': bytes_code, size = [0xD0, 0xE8], 2
            elif dest == 'AX': bytes_code, size = [0xD1, 0xE8], 2
            else: raise SyntaxError(f"Line {line_num}: Unsupported SHR dest")

        # CLC (Clear Carry)
        elif mnem == 'CLC':
            bytes_code, size = [0xF8], 1

        # JUMP ALIASES (Mapping to existing opcodes)
        elif mnem == 'JC':  # Same as JB (72)
            imm_val = ops if not self._is_hex(ops) else int(ops, 16)
            bytes_code, size = [0x72], 2
        elif mnem == 'JNC': # Same as JNB (73)
            imm_val = ops if not self._is_hex(ops) else int(ops, 16)
            bytes_code, size = [0x73], 2
        elif mnem == 'JNL': # Same as JGE (7D)
            imm_val = ops if not self._is_hex(ops) else int(ops, 16)
            bytes_code, size = [0x7D], 2

        else:
            raise SyntaxError(f"Line {line_num}: Unknown instruction {mnem}")
        
        if size == 0:
            raise SyntaxError(f"Line {line_num}: Failed to parse {line}")
        
        return Instruction(addr, mnem, ops, size, bytes_code, imm_val, line)
    
    def _resolve_labels(self):
        """Resolve label names to addresses"""
        for instr in self.instructions:
            if instr.mnem.startswith('J') or instr.mnem == 'LOOP':
                if isinstance(instr.imm_val, str):
                    label = instr.imm_val
                    if label in self.labels:
                        instr.imm_val = self.labels[label]
                    else:
                        raise ValueError(f"Undefined label: {label}")
    
    def _is_hex(self, s: str) -> bool:
        """Check if string is hex number"""
        try:
            int(s, 16)
            return True
        except ValueError:
            return False
    
    def get_machine_code(self) -> List[Tuple[int, List[int], str]]:
        """Generate machine code with addresses"""
        result = []
        for instr in self.instructions:
            bytes_list = list(instr.bytes)
            
            # Add immediate value bytes
            if instr.imm_val is not None and isinstance(instr.imm_val, int):
                if instr.mnem in ['JMP', 'JNZ', 'JZ', 'JNB', 'JNA', 'JA', 'JB', 'JG', 'JL', 'JGE', 'JLE', 'LOOP']:
                    # All jumps are short jumps - relative offset (8-bit signed)
                    offset = instr.imm_val - (instr.addr + instr.size)
                    # Ensure offset fits in signed 8-bit (-128 to +127)
                    if offset < -128 or offset > 127:
                        raise ValueError(f"Jump at {instr.addr:04X} too far ({offset} bytes). Use labels or split code.")
                    bytes_list.append(offset & 0xFF)
                elif instr.size == 2:  # 8-bit immediate
                    bytes_list.append(instr.imm_val & 0xFF)
                elif instr.size == 3:  # 16-bit immediate
                    bytes_list.append(instr.imm_val & 0xFF)
                    bytes_list.append((instr.imm_val >> 8) & 0xFF)
            
            result.append((instr.addr, bytes_list, instr.line))
        
        return result


class Executor:
    """Execute 8086 instructions"""
    def __init__(self, memory: Memory, registers: Registers):
        self.mem = memory
        self.regs = registers
        self.halted = False
        self.instructions: List[Instruction] = []
        self.idx = 0
    
    def load(self, instructions: List[Instruction]):
        """Load instructions into memory and prepare for execution"""
        self.instructions = instructions
        self.idx = 0
        self.halted = False
        
        # Write to memory
        for instr in instructions:
            mc = self._get_machine_bytes(instr)
            for i, byte in enumerate(mc):
                self.mem.write(instr.addr + i, byte)
    
    def _get_machine_bytes(self, instr: Instruction) -> List[int]:
        """Get complete machine code bytes for instruction"""
        bytes_list = list(instr.bytes)
        
        if instr.imm_val is not None and isinstance(instr.imm_val, int):
            if instr.mnem in ['JMP', 'JNZ', 'JZ', 'JNB', 'JNA', 'JA', 'JB', 'JG', 'JL', 'JGE', 'JLE', 'LOOP']:
                # All jumps are short - relative offset
                offset = instr.imm_val - (instr.addr + instr.size)
                bytes_list.append(offset & 0xFF)
            elif instr.size == 2:
                bytes_list.append(instr.imm_val & 0xFF)
            elif instr.size == 3:
                bytes_list.append(instr.imm_val & 0xFF)
                bytes_list.append((instr.imm_val >> 8) & 0xFF)
        
        return bytes_list
    
    def step(self) -> Optional[Instruction]:
        """Execute one instruction"""
        if self.halted or self.idx >= len(self.instructions):
            return None
        
        instr = self.instructions[self.idx]
        jumped = self._execute(instr)
        
        # Only increment if we didn't jump
        if not self.halted and not jumped:
            self.idx += 1
        
        return instr
    
    def _execute(self, instr: Instruction) -> bool:
        """Execute single instruction. Returns True if jumped."""
        mnem = instr.mnem
        ops = instr.ops
        imm = instr.imm_val
        jumped = False
        
        # MOV
        if mnem == 'MOV':
            dest, src = ops.split(',')
            
            if imm is not None:
                # MOV reg, immediate
                self._set_reg(dest, imm)
            elif src in ['[SI]', '[DI]']:
                # MOV reg, [SI/DI]
                addr = self.regs.SI if src == '[SI]' else self.regs.DI
                if len(dest) == 2:  # 16-bit
                    self._set_reg(dest, self.mem.read_word(addr))
                else:  # 8-bit
                    self._set_reg(dest, self.mem.read(addr))
            elif dest in ['[SI]', '[DI]']:
                # MOV [SI/DI], reg
                addr = self.regs.SI if dest == '[SI]' else self.regs.DI
                val = self._get_reg(src)
                if len(src) == 2:  # 16-bit
                    self.mem.write_word(addr, val)
                else:  # 8-bit
                    self.mem.write(addr, val)
            else:
                # MOV reg, reg
                self._set_reg(dest, self._get_reg(src))
        
        # ADD
        elif mnem == 'ADD':
            dest, src = ops.split(',')
            
            # Determine Value Source
            if imm is not None:
                val = imm
            elif src in ['[SI]', '[DI]']:
                addr = self.regs.SI if src == '[SI]' else self.regs.DI
                # If Dest is 16-bit, Read Word. If 8-bit, Read Byte.
                is_dest_16 = dest in ['AX', 'BX', 'CX', 'DX']
                val = self.mem.read_word(addr) if is_dest_16 else self.mem.read(addr)
            else:
                val = self._get_reg(src)

            result = self._get_reg(dest) + val
            
            # Check Flags
            is_16bit = dest in ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'BP']
            size = 16 if is_16bit else 8
            limit = 0xFFFF if size == 16 else 0xFF
            
            self._set_reg(dest, result)
            self.regs.flags['CF'] = 1 if result > limit else 0
            self.regs.update_flags(result, size)
        
        # SUB
        elif mnem == 'SUB':
            dest, src = ops.split(',')
            
            # Determine Value Source
            if imm is not None:
                val = imm
            elif src in ['[SI]', '[DI]']:
                addr = self.regs.SI if src == '[SI]' else self.regs.DI
                is_dest_16 = dest in ['AX', 'BX', 'CX', 'DX']
                val = self.mem.read_word(addr) if is_dest_16 else self.mem.read(addr)
            else:
                val = self._get_reg(src)

            result = self._get_reg(dest) - val
            
            is_16bit = dest in ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'BP']
            size = 16 if is_16bit else 8
            
            self._set_reg(dest, result)
            self.regs.flags['CF'] = 1 if result < 0 else 0
            self.regs.update_flags(result, size)
            
        # ADC
        elif mnem == 'ADC':
            dest, src = ops.split(',')
            val = imm if imm is not None else self._get_reg(src)
            # Add Value + Previous Carry
            result = self._get_reg(dest) + val + self.regs.flags['CF']
            
            is_16bit = dest in ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'BP']
            size = 16 if is_16bit else 8
            limit = 0xFFFF if size == 16 else 0xFF
            
            self._set_reg(dest, result)
            self.regs.flags['CF'] = 1 if result > limit else 0
            self.regs.update_flags(result, size)

        # SBB
        elif mnem == 'SBB':
            dest, src = ops.split(',')
            val = imm if imm is not None else self._get_reg(src)
            # Subtract Value - Previous Borrow (CF)
            result = self._get_reg(dest) - val - self.regs.flags['CF']
            
            is_16bit = dest in ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'BP']
            size = 16 if is_16bit else 8
            
            self._set_reg(dest, result)
            self.regs.flags['CF'] = 1 if result < 0 else 0
            self.regs.update_flags(result, size)
            
        # MUL
        elif mnem == 'MUL':
            # FIXED: Explicitly check for 8-bit vs 16-bit registers
            is_8bit = ops in ['AL', 'BL', 'CL', 'DL', 'AH', 'BH', 'CH', 'DH']
            
            if is_8bit:
                # 8-bit Multiply: AX = AL * reg8
                result = self.regs.AL * self._get_reg(ops)
                self.regs.AX = result & 0xFFFF
                self.regs.update_flags(result, 16) # Result is 16-bit
            else:
                # 16-bit Multiply: DX:AX = AX * reg16
                result = self.regs.AX * self._get_reg(ops)
                self.regs.AX = result & 0xFFFF          # Low Word
                self.regs.DX = (result >> 16) & 0xFFFF  # High Word
                self.regs.update_flags(result, 32)      # Result is 32-bit

        # DIV
        elif mnem == 'DIV':
            divisor = self._get_reg(ops)
            if divisor == 0:
                raise ZeroDivisionError("Division by zero")
            
            # FIXED: Explicitly check for 8-bit vs 16-bit registers
            is_8bit = ops in ['AL', 'BL', 'CL', 'DL', 'AH', 'BH', 'CH', 'DH']
            
            if is_8bit:
                # 8-bit Div: AX / reg8 -> AL (Quotient), AH (Remainder)
                quotient = self.regs.AX // divisor
                remainder = self.regs.AX % divisor
                
                if quotient > 0xFF:
                    raise ValueError("Divide Overflow")
                    
                self.regs.AL = quotient & 0xFF
                self.regs.AH = remainder & 0xFF
            else:
                # 16-bit Div: DX:AX / reg16 -> AX (Quotient), DX (Remainder)
                dividend = (self.regs.DX << 16) | self.regs.AX
                quotient = dividend // divisor
                remainder = dividend % divisor
                
                if quotient > 0xFFFF:
                    raise ValueError("Divide Overflow")
                
                self.regs.AX = quotient & 0xFFFF
                self.regs.DX = remainder & 0xFFFF

        # INC
        elif mnem == 'INC':
            result = self._get_reg(ops) + 1
            self._set_reg(ops, result)
            self.regs.update_flags(result, 16 if len(ops) == 2 else 8)
        
        # DEC
        elif mnem == 'DEC':
            result = self._get_reg(ops) - 1
            self._set_reg(ops, result)
            self.regs.update_flags(result, 16 if len(ops) == 2 else 8)
        
        # CMP
        elif mnem == 'CMP':
            dest, src = ops.split(',')
            val1 = self._get_reg(dest)
            
            # Handle Immediate (Numbers)
            if imm is not None:
                val2 = imm
            # Handle Memory ([SI]/[DI])
            elif src in ['[SI]', '[DI]']:
                addr = self.regs.SI if src == '[SI]' else self.regs.DI
                if len(dest) == 2: val2 = self.mem.read_word(addr)
                else: val2 = self.mem.read(addr)
            # Handle Register
            else:
                val2 = self._get_reg(src)
            
            result = val1 - val2
            size = 16 if len(dest) == 2 else 8
            
            # Update Flags (CF=1 if Borrow/Less Than)
            self.regs.flags['CF'] = 1 if result < 0 else 0
            self.regs.update_flags(result, size)

        # Jumps
        elif mnem == 'JMP':
            self._jump_to(imm)
            jumped = True
        elif mnem == 'JNZ':
            if self.regs.flags['ZF'] == 0:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JZ':
            if self.regs.flags['ZF'] == 1:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JNB':
            if self.regs.flags['CF'] == 0:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JNA':
            if self.regs.flags['CF'] == 1 or self.regs.flags['ZF'] == 1:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JA':
            if self.regs.flags['CF'] == 0 and self.regs.flags['ZF'] == 0:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JB':
            if self.regs.flags['CF'] == 1:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JG':
            if self.regs.flags['ZF'] == 0 and self.regs.flags['SF'] == self.regs.flags['OF']:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JL':
            if self.regs.flags['SF'] != self.regs.flags['OF']:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JGE':
            if self.regs.flags['SF'] == self.regs.flags['OF']:
                self._jump_to(imm)
                jumped = True
        elif mnem == 'JLE':
            if self.regs.flags['ZF'] == 1 or self.regs.flags['SF'] != self.regs.flags['OF']:
                self._jump_to(imm)
                jumped = True
        
        # LOOP
        elif mnem == 'LOOP':
            self.regs.CX = (self.regs.CX - 1) & 0xFFFF
            if self.regs.CX != 0:
                self._jump_to(imm)
                jumped = True
        
        # HLT
        elif mnem == 'HLT':
            self.halted = True
        
        # NOP
        elif mnem == 'NOP':
            pass
        
        # NOT
        elif mnem == 'NOT':
            val = self._get_reg(ops)
            size = 16 if len(ops) == 2 else 8
            mask = 0xFFFF if size == 16 else 0xFF
            result = (~val) & mask
            self._set_reg(ops, result)
            self.regs.update_flags(result, size)

        # NEG
        elif mnem == 'NEG':
            val = self._get_reg(ops)
            size = 16 if len(ops) == 2 else 8
            mask = 0xFFFF if size == 16 else 0xFF
            result = (0 - val) & mask
            self._set_reg(ops, result)
            self.regs.flags['CF'] = 1 if val != 0 else 0 # CF=1 unless result is 0
            self.regs.update_flags(result, size)

        # AND
        elif mnem == 'AND':
            dest, src = ops.split(',')
            val = imm if imm is not None else self._get_reg(src)
            curr = self._get_reg(dest)
            res = curr & val
            self._set_reg(dest, res)
            self.regs.update_flags(res, 16 if len(dest)==2 else 8)
            self.regs.flags['CF'] = 0
            self.regs.flags['OF'] = 0

        # OR
        elif mnem == 'OR':
            dest, src = ops.split(',')
            val = imm if imm is not None else self._get_reg(src)
            curr = self._get_reg(dest)
            res = curr | val
            self._set_reg(dest, res)
            self.regs.update_flags(res, 16 if len(dest)==2 else 8)

        # SHL
        elif mnem == 'SHL':
            dest, _ = ops.split(',')
            val = self._get_reg(dest)
            size = 16 if len(dest)==2 else 8
            
            # CF gets the bit shifted out (the MSB)
            msb = (val >> (size - 1)) & 1
            self.regs.flags['CF'] = msb
            
            res = (val << 1) & (0xFFFF if size==16 else 0xFF)
            self._set_reg(dest, res)
            self.regs.update_flags(res, size)

        # SHR
        elif mnem == 'SHR':
            dest, _ = ops.split(',')
            val = self._get_reg(dest)
            size = 16 if len(dest)==2 else 8
            
            # CF gets the bit shifted out (the LSB)
            self.regs.flags['CF'] = val & 1
            
            res = val >> 1
            self._set_reg(dest, res)
            self.regs.update_flags(res, size)

        # CLC
        elif mnem == 'CLC':
            self.regs.flags['CF'] = 0
            
        # Jump Aliases (Logic is handled by Bytecode mapping in Parser)
        elif mnem in ['JC', 'JNC', 'JNL']:
            # These map to Jumps we already implemented, so we reuse the logic
            if mnem == 'JC':   # behaves like JB
                if self.regs.flags['CF'] == 1: self._jump_to(imm); jumped = True
            elif mnem == 'JNC': # behaves like JNB
                if self.regs.flags['CF'] == 0: self._jump_to(imm); jumped = True
            elif mnem == 'JNL': # behaves like JGE
                if self.regs.flags['SF'] == self.regs.flags['OF']: self._jump_to(imm); jumped = True
                
        return jumped
    
    def _get_reg(self, name: str) -> int:
        """Get register value"""
        return getattr(self.regs, name)
    
    def _set_reg(self, name: str, value: int):
        """Set register value"""
        setattr(self.regs, name, value & (0xFFFF if len(name) == 2 else 0xFF))
    
    def _jump_to(self, addr: int):
        """Jump to address"""
        for i, instr in enumerate(self.instructions):
            if instr.addr == addr:
                self.idx = i
                return
        raise ValueError(f"Invalid jump address: {addr:04X}")
