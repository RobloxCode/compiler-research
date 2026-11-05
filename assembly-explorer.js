"use strict";

/* ===============================================================
 * Assembly Explorer
 *
 * Shows small C-like programs next to x86-64 assembly in Intel
 * syntax, in an unoptimized and an optimized version. Selecting an
 * instruction explains it and highlights the source line it comes
 * from.
 *
 * The assembly is NOT output of this project's compiler. It was
 * written by hand in the style of typical compiler output for the
 * System V AMD64 calling convention (Linux), and checked by
 * assembling and running it. Function frames use rbp, as unoptimized
 * code usually does.
 * ============================================================= */

(function () {

    /* -----------------------------------------------------------
     * Reference data
     * --------------------------------------------------------- */

    const MNEMONICS = {
        mov:
            "Copies the source operand into the destination. It does not " +
            "change the flags. Both operands cannot be memory.",
        add:
            "Adds the source to the destination and stores the sum in the " +
            "destination. It sets the flags.",
        sub:
            "Subtracts the source from the destination and stores the " +
            "result in the destination. It sets the flags.",
        imul:
            "Signed integer multiplication. With three operands, the " +
            "destination gets the second operand times the immediate " +
            "value.",
        lea:
            "Load effective address: computes the address expression in " +
            "brackets and stores the result in the destination, without " +
            "reading memory. Compilers also use it for arithmetic such as " +
            "a + b * 2.",
        xor:
            "Bitwise exclusive OR. xor with the same register on both " +
            "sides sets it to zero, and is the usual short way to write it.",
        cmp:
            "Compares two values by subtracting the second from the first " +
            "and setting the flags. The result itself is thrown away. A " +
            "conditional jump or move reads the flags next.",
        jmp:
            "Unconditional jump: continues execution at the target label.",
        jle:
            "Jump if less or equal (signed): jumps when the last " +
            "comparison found the first value less than or equal to the " +
            "second. Otherwise execution continues with the next " +
            "instruction.",
        cmovg:
            "Conditional move: copies the source to the destination only " +
            "when the last comparison found the first value greater than " +
            "the second (signed). It avoids a branch.",
        call:
            "Pushes the address of the next instruction onto the stack and " +
            "jumps to the function. The function returns with ret.",
        ret:
            "Pops the return address from the stack and jumps to it. An " +
            "int result is expected in eax.",
        push:
            "Subtracts 8 from rsp and stores the operand at the new top " +
            "of the stack.",
        pop:
            "Loads the value at the top of the stack into the operand and " +
            "adds 8 to rsp.",
        leave:
            "Same as mov rsp, rbp followed by pop rbp: it removes the " +
            "function's stack frame."
    };


    const REGISTERS = (function () {
        const registers = {};

        const families = [
            ["rax", "eax", "Accumulator. Holds the integer return value of a function."],
            ["rbx", "ebx", "General purpose; a function must preserve it for its caller."],
            ["rcx", "ecx", "Scratch register; also the 4th integer argument."],
            ["rdx", "edx", "Scratch register; also the 3rd integer argument."],
            ["rsi", "esi", "The 2nd integer argument."],
            ["rdi", "edi", "The 1st integer argument."],
            ["rbp", "ebp", "Frame pointer: the base address of the current stack frame."],
            ["rsp", "esp", "Stack pointer: the current top of the stack."]
        ];

        for (const family of families) {
            registers[family[0]] = { bits: 64, parent: null, role: family[2] };
            registers[family[1]] = { bits: 32, parent: family[0], role: family[2] };
        }

        return registers;
    })();


    const SIZES = { BYTE: 1, WORD: 2, DWORD: 4, QWORD: 8 };

    const TWO_OPERAND_ALU = new Set(["add", "sub", "xor", "imul"]);


    /* -----------------------------------------------------------
     * Examples
     *
     * ins(text, sourceLine, note)  one instruction; sourceLine is a
     *                              0-based index into `source`
     * lbl(name)                    a label (function or jump target)
     * --------------------------------------------------------- */

    function ins(asm, src, note) {
        return { asm: asm, src: src, note: note };
    }

    function lbl(name) {
        return { label: name };
    }


    const EXAMPLES = [
        {
            title: "Arithmetic: constant expression",
            source: ["int result = 3 + 5;"],
            context:
                "A fragment inside a function. result is assumed to be a " +
                "local variable stored at [rbp-4]; the function prologue " +
                "and epilogue are left out.",
            variants: {
                unoptimized: {
                    explanation:
                        "Without constant folding the addition is emitted " +
                        "as written: load 3, add 5, store the result.",
                    lines: [
                        ins("mov eax, 3", 0, "Puts the constant 3 into eax, ready to be used as the left operand of the addition."),
                        ins("add eax, 5", 0, "Adds 5, so eax holds 8. The addition is performed every time this code runs."),
                        ins("mov DWORD PTR [rbp-4], eax", 0, "Stores the result in the local variable result.")
                    ]
                },
                optimized: {
                    explanation:
                        "Constant folding evaluated 3 + 5 while compiling " +
                        "(see Constant Folding in the Optimization " +
                        "Playground), so a single store of the constant 8 " +
                        "remains.",
                    lines: [
                        ins("mov DWORD PTR [rbp-4], 8", 0, "Stores the constant 8 directly in result. The addition no longer exists at run time.")
                    ]
                }
            }
        },
        {
            title: "Arithmetic: expression with variables",
            source: [
                "int f(int a, int b) {",
                "    return a * 2 + b;",
                "}"
            ],
            context:
                "By the System V calling convention, a arrives in edi and b " +
                "in esi.",
            variants: {
                unoptimized: {
                    explanation:
                        "Typical unoptimized code: the arguments are copied " +
                        "into the stack frame, and every variable is read " +
                        "back from memory when it is used.",
                    lines: [
                        lbl("f"),
                        ins("push rbp", 0, "Saves the caller's frame pointer on the stack."),
                        ins("mov rbp, rsp", 0, "Makes rbp point to the new frame. Local variables are addressed relative to it."),
                        ins("mov DWORD PTR [rbp-4], edi", 0, "Copies argument a from edi to the stack at [rbp-4]."),
                        ins("mov DWORD PTR [rbp-8], esi", 0, "Copies argument b from esi to the stack at [rbp-8]."),
                        ins("mov eax, DWORD PTR [rbp-4]", 1, "Loads a back from memory into eax."),
                        ins("imul eax, eax, 2", 1, "Multiplies eax by the immediate 2, giving a * 2."),
                        ins("add eax, DWORD PTR [rbp-8]", 1, "Adds b, read straight from memory. The sum stays in eax, where the caller expects an int result."),
                        ins("pop rbp", 2, "Restores the caller's frame pointer."),
                        ins("ret", 2, "Returns to the caller. The result is already in eax.")
                    ]
                },
                optimized: {
                    explanation:
                        "The arguments stay in registers, no stack frame is " +
                        "needed, and one lea instruction computes a * 2 + b.",
                    lines: [
                        lbl("f"),
                        ins("lea eax, [rsi+rdi*2]", 1, "Computes rsi + rdi * 2, which is b + a * 2, and stores the low 32 bits in eax. No memory is read: lea only evaluates the address expression."),
                        ins("ret", 2, "Returns to the caller. The result is already in eax.")
                    ]
                }
            }
        },
        {
            title: "Conditional branch",
            source: [
                "int max(int a, int b) {",
                "    if (a > b)",
                "        return a;",
                "    return b;",
                "}"
            ],
            context:
                "a arrives in edi and b in esi. Labels such as .L2 are " +
                "local names for jump targets.",
            variants: {
                unoptimized: {
                    explanation:
                        "A comparison followed by a conditional jump. One " +
                        "path loads a, the other loads b, and both end at " +
                        "the function exit.",
                    lines: [
                        lbl("max"),
                        ins("push rbp", 0, "Saves the caller's frame pointer."),
                        ins("mov rbp, rsp", 0, "Sets up the new frame."),
                        ins("mov DWORD PTR [rbp-4], edi", 0, "Copies argument a to the stack."),
                        ins("mov DWORD PTR [rbp-8], esi", 0, "Copies argument b to the stack."),
                        ins("mov eax, DWORD PTR [rbp-4]", 1, "Loads a, the left side of the comparison."),
                        ins("cmp eax, DWORD PTR [rbp-8]", 1, "Compares a with b by computing a - b and setting the flags."),
                        ins("jle .L2", 1, "If a <= b, the condition a > b is false, so jump to .L2 (the code for return b). Otherwise continue with the next instruction."),
                        ins("mov eax, DWORD PTR [rbp-4]", 2, "The condition was true: load a as the return value."),
                        ins("jmp .L3", 2, "Skip the code for return b and go to the function exit."),
                        lbl(".L2"),
                        ins("mov eax, DWORD PTR [rbp-8]", 3, "Load b as the return value."),
                        lbl(".L3"),
                        ins("pop rbp", 4, "Restores the caller's frame pointer."),
                        ins("ret", 4, "Returns to the caller with the result in eax.")
                    ]
                },
                optimized: {
                    explanation:
                        "The branch is replaced by a conditional move, a " +
                        "transformation called if-conversion. There are no " +
                        "jumps and no memory accesses. Compilers choose " +
                        "between a branch and a conditional move depending " +
                        "on the code around it.",
                    lines: [
                        lbl("max"),
                        ins("cmp edi, esi", 1, "Compares a (edi) with b (esi) directly in registers and sets the flags."),
                        ins("mov eax, esi", 3, "Starts with b as the result. mov does not change the flags that cmp just set."),
                        ins("cmovg eax, edi", 2, "If a > b (signed), replaces the result with a. There is no jump to predict."),
                        ins("ret", 4, "Returns to the caller with the result in eax.")
                    ]
                }
            }
        },
        {
            title: "Loop",
            source: [
                "int sum(int n) {",
                "    int s = 0;",
                "    for (int i = 1; i <= n; i++)",
                "        s += i;",
                "    return s;",
                "}"
            ],
            context:
                "n arrives in edi. This function calls no other function, so " +
                "the unoptimized version may use the stack below rsp without " +
                "adjusting it (the red zone of the System V ABI).",
            variants: {
                unoptimized: {
                    explanation:
                        "The variables s and i live in memory, so every " +
                        "iteration loads and stores them. The loop test is " +
                        "placed after the body, and the code jumps to it " +
                        "first.",
                    lines: [
                        lbl("sum"),
                        ins("push rbp", 0, "Saves the caller's frame pointer."),
                        ins("mov rbp, rsp", 0, "Sets up the new frame."),
                        ins("mov DWORD PTR [rbp-20], edi", 0, "Copies argument n to the stack."),
                        ins("mov DWORD PTR [rbp-4], 0", 1, "s = 0: stores the constant 0 in the variable s."),
                        ins("mov DWORD PTR [rbp-8], 1", 2, "i = 1: stores the constant 1 in the variable i."),
                        ins("jmp .L2", 2, "Jumps to the loop test, so the condition is checked before the first iteration."),
                        lbl(".L3"),
                        ins("mov eax, DWORD PTR [rbp-8]", 3, "Loop body: loads i."),
                        ins("add DWORD PTR [rbp-4], eax", 3, "s += i: adds eax to the value of s in memory (read, add and write back)."),
                        ins("add DWORD PTR [rbp-8], 1", 2, "i++: increments the variable i in memory."),
                        lbl(".L2"),
                        ins("mov eax, DWORD PTR [rbp-8]", 2, "Loop test: loads i."),
                        ins("cmp eax, DWORD PTR [rbp-20]", 2, "Compares i with n."),
                        ins("jle .L3", 2, "If i <= n, jumps back to the loop body."),
                        ins("mov eax, DWORD PTR [rbp-4]", 4, "The loop has ended: loads s as the return value."),
                        ins("pop rbp", 5, "Restores the caller's frame pointer."),
                        ins("ret", 5, "Returns to the caller with the result in eax.")
                    ]
                },
                optimized: {
                    explanation:
                        "Register allocation keeps s in eax and i in edx, so " +
                        "the loop has no memory accesses and no stack frame. " +
                        "Production compilers can do more, for example " +
                        "replace this loop by a closed formula.",
                    lines: [
                        lbl("sum"),
                        ins("xor eax, eax", 1, "s = 0, kept in eax. xor of a register with itself is the shortest way to set it to zero."),
                        ins("mov edx, 1", 2, "i = 1, kept in edx."),
                        ins("jmp .L2", 2, "Jumps to the loop test first."),
                        lbl(".L3"),
                        ins("add eax, edx", 3, "s += i, entirely in registers."),
                        ins("add edx, 1", 2, "i++."),
                        lbl(".L2"),
                        ins("cmp edx, edi", 2, "Compares i with n, which is still in edi."),
                        ins("jle .L3", 2, "If i <= n, repeats the loop body."),
                        ins("ret", 5, "Returns. s is already in eax, so no reload is needed.")
                    ]
                }
            }
        },
        {
            title: "Function call",
            source: [
                "int square(int x);",
                "",
                "int g(int a) {",
                "    return square(a) + 1;",
                "}"
            ],
            context:
                "square is defined elsewhere. The argument a arrives in " +
                "edi, and the call passes its argument in edi too.",
            variants: {
                unoptimized: {
                    explanation:
                        "The argument is copied to the stack and loaded " +
                        "again, and a full stack frame is built and removed.",
                    lines: [
                        lbl("g"),
                        ins("push rbp", 2, "Saves the caller's frame pointer."),
                        ins("mov rbp, rsp", 2, "Sets up the new frame."),
                        ins("sub rsp, 16", 2, "Reserves 16 bytes for locals. It also keeps rsp a multiple of 16 at the call, which the ABI requires."),
                        ins("mov DWORD PTR [rbp-4], edi", 2, "Copies argument a to the stack."),
                        ins("mov eax, DWORD PTR [rbp-4]", 3, "Loads a again."),
                        ins("mov edi, eax", 3, "Places a in edi, the register that carries the first argument of square."),
                        ins("call square", 3, "Calls square. Its int result comes back in eax."),
                        ins("add eax, 1", 3, "Adds 1 to the value returned by square."),
                        ins("leave", 4, "Removes the stack frame: restores rsp and the caller's rbp."),
                        ins("ret", 4, "Returns to the caller with the result in eax.")
                    ]
                },
                optimized: {
                    explanation:
                        "a is already in edi, so it is passed on without " +
                        "copying. Only the stack adjustment needed for the " +
                        "call remains. Inlining square would remove the call " +
                        "as well.",
                    lines: [
                        lbl("g"),
                        ins("sub rsp, 8", 2, "On entry rsp is 8 more than a multiple of 16, because the return address was pushed. Subtracting 8 realigns it for the call."),
                        ins("call square", 3, "a is already in edi, the first argument register, so no copy is needed. The result comes back in eax."),
                        ins("add eax, 1", 3, "Adds 1 to the value returned by square."),
                        ins("add rsp, 8", 4, "Gives back the 8 bytes."),
                        ins("ret", 4, "Returns to the caller with the result in eax.")
                    ]
                }
            }
        }
    ];

    let exampleIndex = 0;
    let variantKey = "unoptimized";
    let sourceElements = [];


    function byId(id) {
        return document.getElementById(id);
    }


    /* -----------------------------------------------------------
     * Operand explanations
     * --------------------------------------------------------- */

    function operandRole(mnemonic, index, count) {
        if (mnemonic === "cmp") {
            return index === 0 ? "first value compared" : "second value compared";
        }

        if (mnemonic === "push") {
            return "source";
        }

        if (mnemonic === "pop") {
            return "destination";
        }

        if (mnemonic === "call" || mnemonic.charAt(0) === "j") {
            return "target";
        }

        if (index === 0) {
            return TWO_OPERAND_ALU.has(mnemonic) && count === 2
                ? "destination and first source"
                : "destination";
        }

        return "source";
    }


    function describeOperand(operand, mnemonic) {
        const memory = /^(?:(BYTE|WORD|DWORD|QWORD) PTR )?\[(.+)\]$/i.exec(operand);

        if (memory !== null) {
            const expression = memory[2].replace(/([+-])/g, " $1 ");

            if (mnemonic === "lea") {
                return "address expression " + expression +
                    ". It is only calculated; memory is not accessed.";
            }

            const bytes = SIZES[(memory[1] || "").toUpperCase()];

            return "memory: " + (bytes ? bytes + " bytes" : "a value") +
                " at the address " + expression + ".";
        }

        const register = REGISTERS[operand.toLowerCase()];

        if (register) {
            const width = register.bits + "-bit register" +
                (register.parent ? ", the low half of " + register.parent : "");

            return width + ". " + register.role;
        }

        if (/^-?(?:0x[0-9a-f]+|\d+)$/i.test(operand)) {
            return "immediate value: a constant stored inside the instruction.";
        }

        return "label: the name of an address in the code.";
    }


    function operandsOf(asm) {
        const space = asm.indexOf(" ");

        if (space === -1) {
            return [];
        }

        return asm.slice(space + 1).split(",").map(function (text) {
            return text.trim();
        });
    }


    /* -----------------------------------------------------------
     * Rendering
     * --------------------------------------------------------- */

    function currentVariant() {
        return EXAMPLES[exampleIndex].variants[variantKey];
    }


    function instructionCount(variant) {
        return variant.lines.filter(function (line) {
            return !line.label;
        }).length;
    }


    function clearSelection() {
        for (const element of sourceElements) {
            element.classList.remove("is-linked");
        }

        byId("asmDetailEmpty").hidden = false;
        byId("asmDetailBody").hidden = true;
    }


    function selectInstruction(line, button) {
        const buttons = document.querySelectorAll("#asmListing .asm-line");

        buttons.forEach(function (other) {
            other.removeAttribute("aria-current");
        });

        button.setAttribute("aria-current", "true");

        const example = EXAMPLES[exampleIndex];

        sourceElements.forEach(function (element, index) {
            element.classList.toggle("is-linked", index === line.src);
        });

        const code = byId("asmSelectedCode");
        code.textContent = "";
        CodeHighlight.appendAsm(code, line.asm);

        const mnemonic = line.asm.split(" ")[0].toLowerCase();

        byId("asmWhat").textContent =
            MNEMONICS[mnemonic] || "No description available.";
        byId("asmNote").textContent = line.note;

        const operands = operandsOf(line.asm);
        const list = byId("asmOperands");
        const none = byId("asmNoOperands");

        list.textContent = "";

        operands.forEach(function (operand, index) {
            const item = document.createElement("li");
            const name = document.createElement("code");

            name.textContent = operand;

            item.append(
                name,
                " \u2013 " + operandRole(mnemonic, index, operands.length) +
                ": " + describeOperand(operand, mnemonic)
            );

            list.appendChild(item);
        });

        list.hidden = operands.length === 0;
        none.hidden = operands.length !== 0;

        byId("asmSourceLine").textContent = example.source[line.src].trim();

        byId("asmDetailEmpty").hidden = true;
        byId("asmDetailBody").hidden = false;
    }


    function renderListing() {
        const listing = byId("asmListing");
        const variant = currentVariant();

        listing.textContent = "";

        for (const line of variant.lines) {
            const item = document.createElement("li");

            if (line.label) {
                item.className = "asm-label-row";

                const label = document.createElement("span");
                label.className = "tok-label";
                label.textContent = line.label + ":";

                item.appendChild(label);
            } else {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "asm-line";
                button.setAttribute("aria-controls", "asmDetails");

                const code = document.createElement("code");
                CodeHighlight.appendAsm(code, line.asm);

                button.appendChild(code);

                button.addEventListener("click", function () {
                    selectInstruction(line, button);
                });

                item.appendChild(button);
            }

            listing.appendChild(item);
        }
    }


    function render() {
        const example = EXAMPLES[exampleIndex];
        const variant = currentVariant();

        sourceElements = CodeHighlight.renderLines(
            byId("asmSourceCode"),
            example.source,
            { language: "c" }
        );

        renderListing();
        clearSelection();

        byId("asmContext").textContent = example.context;

        const other = variantKey === "unoptimized" ? "optimized" : "unoptimized";

        byId("asmVariantNote").textContent = variant.explanation;
        byId("asmCount").textContent =
            "This listing has " + instructionCount(variant) +
            " instructions; the " + other + " version has " +
            instructionCount(example.variants[other]) + ".";
    }


    function init() {
        const select = byId("asmExample");

        if (!select) {
            return;
        }

        EXAMPLES.forEach(function (example, index) {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = example.title;
            select.appendChild(option);
        });

        select.addEventListener("change", function () {
            exampleIndex = select.selectedIndex;
            render();
        });

        const radios = document.querySelectorAll('input[name="asmVariant"]');

        radios.forEach(function (radio) {
            radio.addEventListener("change", function () {
                if (radio.checked) {
                    variantKey = radio.value;
                    render();
                }
            });
        });

        render();
    }


    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();