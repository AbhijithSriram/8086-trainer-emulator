# 8086 Trainer Kit Emulator 

A robust, full-stack 8086 Assembly Language emulator that simulates a physical trainer kit. Unlike static web emulators, this project uses a Python backend to ensure accurate register behavior, flag management, and 16-bit arithmetic operations.

Built out of self interest for the IT Department at SSN College of Engineering to facilitate UIT3363 - Digital Systems and Microprocessers Design Laboratory practice and self-learning.

---

##  Live Demo

**[Click here to launch the Emulator](https://emulator-8086-598092406092.asia-south1.run.app/)** (Hosted on Google Cloud Run)

---

##  Key Features

- **Python-Powered Backend**: Accurate instruction parsing and memory management handles edge cases (like 16-bit overflows) that pure JS emulators often miss.

- **Dynamic Address Gutter**: An IDE-like experience that calculates instruction size in real-time and displays memory addresses next to your code.

- **Memory Editor**: View and Edit memory directly (Input arrays, variables, etc.) using a hexadecimal interface.

- **Step-by-Step Debugging**: Watch AX, BX, CX, DX, and Flags (CF, ZF, SF, etc.) update after every single line.

- **Adjustable Speed**: Control execution speed from 50ms to 2000ms per instruction.

---

##  Supported Instruction Set

This emulator supports a comprehensive set of instructions required for academic syllabi:

### Data Transfer
- **MOV** - Supports Register-to-Register, Immediate-to-Register, and Memory-to-Register.

### Arithmetic
- **ADD, SUB** - 8-bit and 16-bit addition/subtraction (Handles Carry/Borrow).
- **MUL, DIV** - Unsigned multiplication and division.
- **INC, DEC** - Increment and decrement (8-bit & 16-bit).

### Logical & Bitwise
- **AND, OR, XOR** - Logical operations.
- **NOT** - 1's Complement.
- **NEG** - 2's Complement.
- **SHL, SHR** - Shift Left and Shift Right.

### Control Flow
- **JMP** - Unconditional Jump.
- **LOOP** - Decrements CX and jumps if not zero.
- **CMP** - Compare values (updates flags).
- **Conditional Jumps**: JZ (Jump Zero), JNZ (Jump Not Zero), JC (Jump Carry), JNC (Jump No Carry), JNB, JNA, JGE, etc.
- **HLT** - Halt execution.

---

##  Technology Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Python 3.11, Flask (API & Emulator Logic) |
| **Frontend** | HTML5, CSS3 (Retro Theme), JavaScript (Async Fetch API) |
| **Containerization** | Docker |
| **Cloud** | Google Cloud Run (Serverless Deployment) |

---

##  Example Programs

### 1. Ascending Order Sort (Array)

Set Start Address to `1100`. Input array at `1300` (Size N, followed by N numbers).

```assembly
MOV SI, 1300      ; Point to Array Size
MOV CL, [SI]      ; Load Outer Count
OUTER:
MOV SI, 1300      ; Reset Pointer
MOV DL, [SI]      ; Load Inner Count
INC SI            ; Point to first element
MOV AL, [SI]      ; Load current max
DEC DL
JZ NEXT_PASS
INNER:
INC SI
MOV BL, [SI]
CMP AL, BL
JNB NOSWAP
DEC SI            ; Swap Logic
MOV [SI], AL
MOV AL, BL
JMP CONT
NOSWAP:
DEC SI
MOV [SI], BL
INC SI
CONT:
DEC DL
JNZ INNER
NEXT_PASS:
MOV [SI], AL
DEC CL
JNZ OUTER
HLT
```

### 2. Sum of Series (16-bit Result)

Calculates sum of 8-bit numbers where the total exceeds 255.

```assembly
MOV SI, 2000      ; Point to count
MOV CL, [SI]
MOV AX, 0000      ; Use 16-bit Accumulator
MOV BX, 0000      ; Helper for 8-bit moves
INC SI
AGAIN:
MOV BL, [SI]      ; Load number
ADD AX, BX        ; Add to 16-bit AX
INC SI
DEC CL
JNZ AGAIN
MOV [SI], AX      ; Store 16-bit result
HLT
```

---

##  Local Development

Since this project uses a Python backend, you cannot just open `index.html`.

### Option 1: Using Python

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AbhijithSriram/8086-trainer-emulator.git
   cd 8086-trainer-emulator
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Flask server:**
   ```bash
   python app.py
   ```

4. **Open browser at** `http://localhost:8080`

### Option 2: Using Docker

1. **Build the container:**
   ```bash
   docker build -t 8086-emulator .
   ```

2. **Run the container:**
   ```bash
   docker run -p 8080:8080 8086-emulator
   ```

3. **Open browser at** `http://localhost:8080`

---

