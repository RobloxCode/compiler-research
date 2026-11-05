"use strict";

/* ===============================================================
 * Optimization Playground
 *
 * Shows a predefined before/after pair for each of the seven
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
                "variables, and seeing through them is the job of constant " +
                "propagation.",
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
            id: "constant-propagation",
            name: "Constant Propagation",
            summary:
                "Replaces a use of a variable with its value when that value " +
                "is a known constant at that point.",
            before: {
                code: [
                    "int g(int n) {",
                    "    int k = 4;",
                    "    int y = n * k;",
                    "    int z = k + k;",
                    "    return y + z;",
                    "}"
                ],
                marked: [3, 4]
            },
            after: {
                code: [
                    "int g(int n) {",
                    "    int k = 4;",
                    "    int y = n * 4;",
                    "    int z = 4 + 4;",
                    "    return y + z;",
                    "}"
                ],
                marked: [3, 4]
            },
            changed:
                "k is set to 4 and never changes, so each later use of k " +
                "was replaced by 4. The assignment to k now has no readers. " +
                "The new 4 + 4 can be folded into 8, and DCE can then " +
                "remove k, which is why these passes are usually run " +
                "together.",
            valid:
                "At each use, the only assignment to k that can reach it is " +
                "k = 4. Reaching-definitions analysis proves this. If some " +
                "path could give k another value, the replacement would be " +
                "wrong.",
            benefit:
                "A variable read becomes an immediate operand in the " +
                "instruction, and it exposes new folding and DCE " +
                "opportunities.",
            limits: [
                "Every definition that reaches the use must assign the same constant. After a branch that sets k to 4 on one path and 5 on the other, k is not a constant.",
                "Variables that can be changed through a pointer, or that are volatile, cannot be propagated without more analysis.",
                "Sparse conditional constant propagation (Wegman and Zadeck, 1991) is more precise: it also ignores branches whose condition is a known constant."
            ]
        },
        {
            id: "dead-code-elimination",
            name: "Dead Code Elimination (DCE)",
            summary:
                "Removes code whose result is never used or that can never " +
                "execute.",
            before: {
                code: [
                    "int h(int x) {",
                    "    int unused = x * 7;",
                    "    int y = x + 1;",
                    "    return y;",
                    "    y = y * 2;",
                    "}"
                ],
                marked: [2, 5]
            },
            after: {
                code: [
                    "int h(int x) {",
                    "    int y = x + 1;",
                    "    return y;",
                    "}"
                ],
                marked: []
            },
            changed:
                "Two statements were removed. unused is computed but never " +
                "read, and y = y * 2 comes after the return, so it can " +
                "never run.",
            valid:
                "A computation whose result is never used can be deleted " +
                "when it has no side effects: multiplying integers writes " +
                "no memory, calls nothing and does no I/O. Code after a " +
                "return is unreachable, so it cannot affect the behavior.",
            benefit:
                "Smaller code and fewer instructions executed. DCE also " +
                "cleans up what folding and propagation leave behind, such " +
                "as variables that are no longer read.",
            limits: [
                "Statements with side effects must stay even when their result is unused: function calls, writes through pointers and accesses to volatile objects.",
                "Deciding that a value is unused needs liveness analysis over all paths, including loops.",
                "Finding unreachable code needs the control-flow graph."
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
            id: "auto-vectorization",
            name: "Auto-vectorization",
            summary:
                "Replaces repeated scalar operations with SIMD instructions " +
                "that process several values at once.",
            before: {
                code: [
                    "float a[1024], b[1024], c[1024];",
                    "",
                    "void add(void) {",
                    "    for (int i = 0; i < 1024; i++) {",
                    "        c[i] = a[i] + b[i];",
                    "    }",
                    "}"
                ],
                marked: [4, 5]
            },
            after: {
                code: [
                    "#include <xmmintrin.h>",
                    "",
                    "float a[1024], b[1024], c[1024];",
                    "",
                    "void add(void) {",
                    "    for (int i = 0; i < 1024; i += 4) {",
                    "        __m128 va = _mm_loadu_ps(&a[i]);",
                    "        __m128 vb = _mm_loadu_ps(&b[i]);",
                    "        _mm_storeu_ps(&c[i], _mm_add_ps(va, vb));",
                    "    }",
                    "}"
                ],
                marked: [1, 6, 7, 8, 9]
            },
            changed:
                "The scalar loop adds one pair of floats per iteration. " +
                "Each iteration of the new loop loads four consecutive " +
                "floats from a and from b into 128-bit SSE registers, adds " +
                "the four pairs with one instruction and stores four " +
                "results. There are 256 iterations instead of 1024.",
            valid:
                "Each iteration is independent of the others, and a, b and " +
                "c are different arrays, so computing four elements at once " +
                "gives the same values as computing them one by one. 1024 " +
                "is a multiple of 4, so no scalar remainder loop is needed, " +
                "and the unaligned load and store instructions work for any " +
                "address.",
            benefit:
                "Up to four times fewer arithmetic and memory instructions " +
                "in this loop. With AVX, eight floats fit in one register. " +
                "The real speedup depends on the memory bandwidth and the " +
                "processor.",
            limits: [
                "Iterations must be independent. A dependence such as a[i] = a[i - 1] + b[i] prevents this simple form.",
                "The compiler must prove the arrays do not overlap, or insert a run-time check.",
                "When the trip count is not a multiple of the vector width, a scalar loop must handle the remaining elements.",
                "Summing floats in a different order changes rounding, so reductions are vectorized only when the compiler is allowed to reorder them (for example with -ffast-math)."
            ],
            note:
                "The SSE intrinsics are written out only to show the effect. " +
                "A compiler performs this change on its IR or machine " +
                "instructions; the programmer does not write intrinsics for " +
                "it to happen."
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