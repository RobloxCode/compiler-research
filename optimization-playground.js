"use strict";

/* ===============================================================
 * Optimization Playground
 *
 * Shows a predefined before/after pair for each of the eight
 * optimizations studied in this research. Nothing here analyzes or
 * transforms code: the "optimized" versions are written by hand to
 * illustrate each transformation. It is not output from the compiler.
 *
 * Each example is plain C using a small subset (int and float,
 * pointers, for loops), close to what a didactic compiler can accept.
 * `marked` lists the 1-based lines to highlight once the optimization
 * is applied: replaced or removed lines on the original side, new or
 * changed lines on the optimized side.
 * ============================================================= */

(function () {

    const OPTIMIZATIONS = [
        {
            id: "constant-folding",
            name: "Constant Folding",
            summary:
                "Evaluates expressions whose operands are constants while " +
                "compiling, instead of every time the program runs.",
            before: {
                code: [
                    "int f(int n) {",
                    "    int a = 3 + 5;",
                    "    int b = 60 * 60 * 24;",
                    "    return n + a + b;",
                    "}"
                ],
                marked: [2, 3]
            },
            after: {
                code: [
                    "int f(int n) {",
                    "    int a = 8;",
                    "    int b = 86400;",
                    "    return n + a + b;",
                    "}"
                ],
                marked: [2, 3]
            },
            changed:
                "3 + 5 and 60 * 60 * 24 contain only constants, so they are " +
                "computed at compile time and replaced by 8 and 86400. The " +
                "return expression is unchanged: a and b are still " +
                "variables, and seeing through them is the job of global " +
                "constant propagation.",
            valid:
                "Adding or multiplying the same constants always gives the " +
                "same result, so computing it early cannot change what the " +
                "program does. The compiler must use the semantics of the " +
                "language and the target, such as 32-bit wrap-around for " +
                "unsigned int.",
            benefit:
                "Two arithmetic operations disappear from every execution, " +
                "and the constants become visible to later passes.",
            limits: [
                "Only expressions whose operands are all known constants can be folded.",
                "Division by a constant zero must not be folded: it is an error at run time, and the compiler should leave it alone or report it.",
                "Floating-point results must match the rounding behavior of the target."
            ]
        },
        {
            id: "common-subexpression-elimination",
            name: "Common Subexpression Elimination (CSE)",
            summary:
                "Computes an expression once and reuses the result when the " +
                "same expression appears again with unchanged operands.",
            before: {
                code: [
                    "int k(int a, int b, int c) {",
                    "    int x = (a + b) * c;",
                    "    int y = (a + b) * 2;",
                    "    return x + y;",
                    "}"
                ],
                marked: [2, 3]
            },
            after: {
                code: [
                    "int k(int a, int b, int c) {",
                    "    int t = a + b;",
                    "    int x = t * c;",
                    "    int y = t * 2;",
                    "    return x + y;",
                    "}"
                ],
                marked: [2, 3, 4]
            },
            changed:
                "a + b was computed twice. It is now computed once into the " +
                "temporary t, and both products use t.",
            valid:
                "a and b are not modified between the two evaluations, and " +
                "a + b has no side effects, so both evaluations give the " +
                "same value. Available-expressions analysis finds such " +
                "cases across basic blocks too.",
            benefit:
                "One addition less per execution. Larger expressions, such " +
                "as address calculations, save more.",
            limits: [
                "An assignment to a or b between the two evaluations invalidates the earlier result.",
                "A memory load can be reused only if no store in between might write to the same location.",
                "Keeping t alive for longer occupies a register for longer. When registers are scarce, recomputing a cheap expression can be better."
            ]
        },
        {
            id: "loop-invariant-code-motion",
            name: "Loop-Invariant Code Motion (LICM)",
            summary:
                "Moves a computation that gives the same result on every " +
                "iteration out of the loop.",
            before: {
                code: [
                    "void scale(int *a, int n, int k, int m) {",
                    "    for (int i = 0; i < n; i++) {",
                    "        a[i] = a[i] * (k * m + 1);",
                    "    }",
                    "}"
                ],
                marked: [3]
            },
            after: {
                code: [
                    "void scale(int *a, int n, int k, int m) {",
                    "    int f = k * m + 1;",
                    "    for (int i = 0; i < n; i++) {",
                    "        a[i] = a[i] * f;",
                    "    }",
                    "}"
                ],
                marked: [2, 4]
            },
            changed:
                "k * m + 1 depends only on k and m, which do not change in " +
                "the loop, yet it was computed on every iteration. It is " +
                "now computed once into f before the loop, and the loop " +
                "body uses f.",
            valid:
                "k and m are not assigned in the loop, and the store to " +
                "a[i] cannot change them because they are parameters passed " +
                "by value whose address is never taken. The expression has " +
                "no side effects and cannot fail, so computing it even when " +
                "the loop runs zero times is harmless.",
            benefit:
                "n multiplications and additions become one. The saving " +
                "grows with the number of iterations.",
            limits: [
                "The compiler must find the loop (for example with dominators in the control-flow graph) and prove the operands are invariant.",
                "An expression that can fail or has side effects, such as a division or a function call, can be hoisted only if the loop is known to run at least once.",
                "A load from memory can be hoisted only if no store in the loop can change that location."
            ]
        },
        {
            id: "loop-unrolling",
            name: "Loop Unrolling",
            summary:
                "Repeats the loop body several times per iteration to reduce " +
                "the cost of the loop control.",
            before: {
                code: [
                    "int sum(const int *a) {",
                    "    int s = 0;",
                    "    for (int i = 0; i < 8; i++) {",
                    "        s += a[i];",
                    "    }",
                    "    return s;",
                    "}"
                ],
                marked: [3]
            },
            after: {
                code: [
                    "int sum(const int *a) {",
                    "    int s = 0;",
                    "    for (int i = 0; i < 8; i += 4) {",
                    "        s += a[i];",
                    "        s += a[i + 1];",
                    "        s += a[i + 2];",
                    "        s += a[i + 3];",
                    "    }",
                    "    return s;",
                    "}"
                ],
                marked: [3, 5, 6, 7]
            },
            changed:
                "The original loop runs 8 times. In the unrolled version the " +
                "body is repeated four times and i advances by 4, so the " +
                "loop runs twice. The additions still happen in the same " +
                "order.",
            valid:
                "The trip count (8) is known and is a multiple of the " +
                "unroll factor (4), so no iteration is added or lost and no " +
                "leftover loop is needed. The updates of s keep their " +
                "order, so the result is identical.",
            benefit:
                "The compare, branch and counter increment run 2 times " +
                "instead of 8. The longer body also gives later passes " +
                "more instructions to work with.",
            limits: [
                "If the trip count is unknown or not a multiple of the factor, the compiler needs an extra loop (or a guard) for the remaining iterations.",
                "Code size grows with the factor, which can hurt the instruction cache.",
                "The gain is small when the body is expensive compared with the loop control."
            ]
        },
        {
            id: "global-constant-propagation",
            name: "Global Constant Propagation",
            summary:
                "Replaces a use of a variable with its value when that value " +
                "is the same known constant on every path that reaches the " +
                "use, even across branches.",
            before: {
                code: [
                    "int g(int n) {",
                    "    int k = 4;",
                    "    int m;",
                    "    if (n > 0) {",
                    "        m = 10;",
                    "    } else {",
                    "        m = 10;",
                    "    }",
                    "    return n * k + m;",
                    "}"
                ],
                marked: [9]
            },
            after: {
                code: [
                    "int g(int n) {",
                    "    int k = 4;",
                    "    int m;",
                    "    if (n > 0) {",
                    "        m = 10;",
                    "    } else {",
                    "        m = 10;",
                    "    }",
                    "    return n * 4 + 10;",
                    "}"
                ],
                marked: [9]
            },
            changed:
                "k is set to 4 before the if and neither branch changes it, " +
                "so its use in the return became 4. m is assigned 10 in both " +
                "branches, so after the branches join it still holds the " +
                "constant 10, and its use became 10. The assignments to k " +
                "and m now have no readers, and dead assignment elimination " +
                "can remove them.",
            valid:
                "Data-flow analysis (reaching definitions) walks the " +
                "control-flow graph and combines the facts from both " +
                "branches at the join. The only definition of k that reaches " +
                "the return is k = 4, and both definitions of m that reach " +
                "it assign 10, so every possible execution sees the same " +
                "values. This is what makes it global: the facts travel " +
                "across basic blocks instead of staying inside one.",
            benefit:
                "Variable reads become immediate operands, which frees " +
                "registers, and the constants expose more folding, dead " +
                "assignments and branches with a known condition.",
            limits: [
                "If the branches assigned different values, such as 10 and 20, m would not be a constant at the join and could not be replaced.",
                "A variable that changes inside a loop is not constant at the loop header, so the analysis must iterate over the loop until its facts stop changing.",
                "Variables whose address is taken, or that are volatile, cannot be propagated without more analysis, since a write through a pointer could change them.",
                "Sparse conditional constant propagation (Wegman and Zadeck, 1991) is more precise: it also ignores branches whose condition is a known constant."
            ]
        },
        {
            id: "dead-assignment-elimination",
            name: "Dead Assignment Elimination",
            summary:
                "Removes an assignment whose value is never read afterwards, " +
                "because the variable is overwritten first or never used " +
                "again (also called dead store elimination).",
            before: {
                code: [
                    "int h(int x) {",
                    "    int a = x * 7;",
                    "    a = x + 1;",
                    "    int b = a * 2;",
                    "    int c = a + 3;",
                    "    return c;",
                    "}"
                ],
                marked: [2, 4]
            },
            after: {
                code: [
                    "int h(int x) {",
                    "    int a = x + 1;",
                    "    int c = a + 3;",
                    "    return c;",
                    "}"
                ],
                marked: []
            },
            changed:
                "Two assignments were removed. The value that a receives from " +
                "x * 7 on line 2 is overwritten on line 3 before anything " +
                "reads it, and b on line 4 is computed but never read. The " +
                "assignment on line 3 now initializes a directly.",
            valid:
                "Liveness analysis runs backward from the end of the " +
                "function. Right after line 2 the next thing that happens to " +
                "a is a new assignment, so the old value is not live, and b " +
                "is never live at all. Removing an assignment that no later " +
                "instruction reads cannot change the result, and x * 7 and " +
                "a * 2 have no side effects.",
            benefit:
                "Fewer instructions executed and fewer registers or stack " +
                "slots in use. It also cleans up the assignments that " +
                "constant propagation leaves without readers.",
            limits: [
                "An assignment is dead only if it is dead on every path. If a single path can read the value, the assignment must stay.",
                "If the right-hand side has side effects, such as a function call, the assignment can be removed but the call must stay.",
                "Stores to memory (through pointers, arrays or volatile objects) need alias information to prove that nobody reads them later.",
                "Liveness over loops needs the analysis to iterate until its results stop changing."
            ]
        },
        {
            id: "function-inlining",
            name: "Function Inlining",
            summary:
                "Replaces a call with a copy of the function body, with the " +
                "arguments substituted for the parameters.",
            before: {
                code: [
                    "int square(int x) {",
                    "    return x * x;",
                    "}",
                    "",
                    "int f(int a) {",
                    "    return square(a) + 1;",
                    "}"
                ],
                marked: [6]
            },
            after: {
                code: [
                    "int square(int x) {",
                    "    return x * x;",
                    "}",
                    "",
                    "int f(int a) {",
                    "    return a * a + 1;",
                    "}"
                ],
                marked: [6]
            },
            changed:
                "The call square(a) was replaced by the body of square, with " +
                "the argument a in place of the parameter x. f no longer " +
                "calls anything, so the call, the return and the argument " +
                "passing disappear from it. square itself stays in the file " +
                "because other code may still call it.",
            valid:
                "The body only reads its parameter and has no side effects, " +
                "so running it in place gives the same value as calling it. " +
                "The argument is a plain variable, so using it twice in a * a " +
                "evaluates nothing twice. If the argument were an expression " +
                "with side effects, such as another call or i++, the " +
                "compiler would first store it in a temporary.",
            benefit:
                "The cost of the call disappears: passing arguments, the " +
                "call and return instructions and the stack frame setup. " +
                "It also lets later passes see through the old boundary, " +
                "for example folding the whole expression if a were a " +
                "known constant.",
            limits: [
                "Recursive functions cannot be inlined without limit, because each copy contains another call.",
                "Every inlined call site gets its own copy of the body, so code size grows. Compilers use size and cost heuristics to decide.",
                "The compiler must see the body of the function. Functions defined in another file, or called through a function pointer, cannot be inlined in the simple case.",
                "Parameters, local variables and return statements must be renamed or rewritten so the copy does not clash with the caller's variables."
            ],
            note:
                "Compilers inline on their IR, not on the source text. The " +
                "rewritten C is shown only to illustrate the effect."
        },
        {
            id: "unreachable-function-elimination",
            name: "Unreachable Function Elimination",
            summary:
                "Removes functions that can never be called, found by " +
                "following the calls that start at the program entry point.",
            before: {
                code: [
                    "static int helper(int x) {",
                    "    return x * 3;",
                    "}",
                    "",
                    "static int unused(int x) {",
                    "    return helper(x) + 1;",
                    "}",
                    "",
                    "int main(void) {",
                    "    return helper(4);",
                    "}"
                ],
                marked: [5, 6, 7]
            },
            after: {
                code: [
                    "static int helper(int x) {",
                    "    return x * 3;",
                    "}",
                    "",
                    "int main(void) {",
                    "    return helper(4);",
                    "}"
                ],
                marked: []
            },
            changed:
                "unused was removed because nothing reachable from main " +
                "calls it. helper stays because main calls it. The call to " +
                "helper inside unused does not count: only calls made by " +
                "reachable functions matter.",
            valid:
                "The compiler builds the call graph and marks every function " +
                "reachable from the entry point, main. A function that is " +
                "not marked can never execute, so deleting it cannot change " +
                "the behavior. Here it is safe because both functions are " +
                "static, so no other file can call them.",
            benefit:
                "A smaller binary and less code to compile, load and keep in " +
                "memory. It can also help other passes: once unused is gone, " +
                "helper has a single caller, which makes it a better " +
                "candidate for inlining.",
            limits: [
                "A function with external linkage must be kept unless the compiler sees the whole program (for example with link-time optimization), because another file may call it.",
                "A function whose address is taken counts as reachable, and an indirect call must be assumed to reach any such function.",
                "Reachability is what matters, not the number of callers: functions that only call each other, but are never reached from the entry point, are all removed.",
                "Libraries and programs with several entry points need every exported function treated as an entry point."
            ]
        }
    ];

    let currentIndex = 0;
    let applied = false;


    function byId(id) {
        return document.getElementById(id);
    }


    function toMarks(lines, kind) {
        const marks = {};

        for (const number of lines) {
            marks[number] = kind;
        }

        return marks;
    }


    /* "line 3", "lines 2 and 5", "lines 3, 5, 6 and 7" */

    function describeLines(numbers) {
        if (numbers.length === 1) {
            return "line " + numbers[0];
        }

        return (
            "lines " +
            numbers.slice(0, -1).join(", ") +
            " and " +
            numbers[numbers.length - 1]
        );
    }


    function diffSummary(optimization) {
        const oldLines = optimization.before.marked;
        const newLines = optimization.after.marked;

        const original = oldLines.length === 0
            ? "Original: no lines replaced or removed."
            : "Original: " + describeLines(oldLines) + " replaced or removed.";

        const optimized = newLines.length === 0
            ? "Optimized: no new lines."
            : "Optimized: " + describeLines(newLines) + " new or changed.";

        return "Applied " + optimization.name + ". " + original + " " + optimized;
    }


    function fillList(list, items) {
        list.textContent = "";

        for (const text of items) {
            const item = document.createElement("li");
            item.textContent = text;
            list.appendChild(item);
        }
    }


    function render() {
        const optimization = OPTIMIZATIONS[currentIndex];

        byId("optSummary").textContent = optimization.summary;

        CodeHighlight.renderLines(byId("optBeforeCode"), optimization.before.code, {
            marks: applied ? toMarks(optimization.before.marked, "old") : {}
        });

        const afterCode = byId("optAfterCode");

        if (applied) {
            CodeHighlight.renderLines(afterCode, optimization.after.code, {
                marks: toMarks(optimization.after.marked, "new")
            });
        } else {
            afterCode.textContent = "";

            const placeholder = document.createElement("span");
            placeholder.className = "code-placeholder";
            placeholder.textContent =
                "Not applied yet. Choose \u201CApply optimization\u201D.";
            afterCode.appendChild(placeholder);
        }

        byId("optExplanationEmpty").hidden = applied;
        byId("optExplanationBody").hidden = !applied;
        byId("optDiffSummary").textContent = applied ? diffSummary(optimization) : "";

        if (applied) {
            byId("optChanged").textContent = optimization.changed;
            byId("optValid").textContent = optimization.valid;
            byId("optBenefit").textContent = optimization.benefit;
            fillList(byId("optLimits"), optimization.limits);

            const note = byId("optNote");
            note.textContent = optimization.note || "";
            note.hidden = !optimization.note;
        }

        byId("optApply").disabled = applied;
        byId("optReset").disabled = !applied;
    }


    function choose(index) {
        currentIndex = index;
        applied = false;
        render();
    }


    function init() {
        const select = byId("optSelect");

        if (!select) {
            return;
        }

        OPTIMIZATIONS.forEach(function (optimization) {
            const option = document.createElement("option");
            option.value = optimization.id;
            option.textContent = optimization.name;
            select.appendChild(option);
        });

        select.addEventListener("change", function () {
            choose(select.selectedIndex);
        });

        byId("optApply").addEventListener("click", function () {
            applied = true;
            render();
            byId("optReset").focus();
        });

        byId("optReset").addEventListener("click", function () {
            applied = false;
            render();
            byId("optApply").focus();
        });

        choose(0);
    }


    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();