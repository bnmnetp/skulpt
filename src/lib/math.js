const $builtinmodule = function (name) {
    const {
        builtin: {
            str: pyStr,
            int_: pyInt,
            float_: pyFloat,
            TypeError: pyTypeError,
            pyCheckType,
            checkNumber,
        },
        abstr: { lookupSpecial },
        misceval: { callsimOrSuspendArray: pyCallOrSuspend },
    } = Sk;

    const math = {
        // Mathematical Constants
        pi: new Sk.builtin.float_(Math.PI),
        e: new Sk.builtin.float_(Math.E),
        tau: new Sk.builtin.float_(2 * Math.PI),
        nan: new Sk.builtin.float_(NaN),
        inf: new Sk.builtin.float_(Infinity),
    };

    // Number-theoretic and representation functions
    const s_ceil = new pyStr("__ceil__");

    function ceil(x) {
        let _x;
        if (x.ob$type !== pyFloat) {
            const method = lookupSpecial(x, s_ceil);
            if (method !== undefined) {
                return pyCallOrSuspend(method);
            }
            pyCheckType("", "real number", checkNumber(x));
            _x = Sk.builtin.asnum$(x);
        } else {
            _x = x.v;
        }
        return new pyInt(Math.ceil(_x));
    }

    function comb(n, k) {
        let n_js = Sk.misceval.asIndexOrThrow(n);
        let k_js = Sk.misceval.asIndexOrThrow(k);
        if (n_js < 0) {
            throw new Sk.builtin.ValueError(
                "n must be an non-negative integer"
            );
        }
        if (k_js < 0) {
            throw new Sk.builtin.ValueError("k must be a non-negative integer");
        }
        if (k_js > n) {
            return new Sk.builtin.int_(0);
        }
        n = new Sk.builtin.int_(n_js);
        k = new Sk.builtin.int_(k_js);
        let temp = Sk.ffi.remapToJs(n.nb$subtract(k));
        if (temp < k_js) {
            k_js = temp;
        }
        if (k_js === 0) {
            return new Sk.builtin.int_(1);
        }
        if (k_js > Number.MAX_SAFE_INTEGER) {
            throw new Sk.builtin.OverflowError(
                "min(n - k, k) must not exceed " + Number.MAX_SAFE_INTEGER
            );
        }

        const one = new Sk.builtin.int_(1);
        let tot = n;
        for (let i = 1; i < k_js; i++) {
            n = n.nb$subtract(one);
            temp = new Sk.builtin.int_(i + 1);
            tot = tot.nb$multiply(n);
            tot = tot.nb$floor_divide(temp);
        }
        return tot;
    }

    const get_sign = function (n) {
        //deals with signed zeros
        // returns -1 or +1 for the sign
        if (n) {
            n = n < 0 ? -1 : 1;
        } else {
            n = 1 / n < 0 ? -1 : 1;
        }
        return n;
    };

    function copysign(x, y) {
        // returns abs of x with sign y
        // does sign x * sign y * x which is equivalent
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        Sk.builtin.pyCheckType("y", "number", Sk.builtin.checkNumber(y));

        const _y = Sk.builtin.asnum$(y);
        const _x = Sk.builtin.asnum$(x);
        const sign_x = get_sign(_x);
        const sign_y = get_sign(_y);
        const sign = sign_x * sign_y;

        return new Sk.builtin.float_(_x * sign);
    }

    function fabs(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        let _x = x.v;
        if (JSBI.__isBigInt(_x)) {
            _x = x.nb$float().v; //should raise OverflowError for large ints to floats
        }
        _x = Math.abs(_x);

        return new Sk.builtin.float_(_x);
    }

    const MAX_SAFE_INTEGER_FACTORIAL = 18; // 19! > Number.MAX_SAFE_INTEGER
    function factorial(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        let _x = Sk.builtin.asnum$(x);
        x = Math.floor(_x);

        if (x != _x) {
            throw new Sk.builtin.ValueError(
                "factorial() only accepts integral values"
            );
        }
        if (x < 0) {
            throw new Sk.builtin.ValueError(
                "factorial() not defined for negative numbers"
            );
        }

        let r = 1;
        for (let i = 2; i <= x && i <= MAX_SAFE_INTEGER_FACTORIAL; i++) {
            r *= i;
        }
        if (x <= MAX_SAFE_INTEGER_FACTORIAL) {
            return new Sk.builtin.int_(r);
        } else {
            r = JSBI.BigInt(r);
            for (let i = MAX_SAFE_INTEGER_FACTORIAL + 1; i <= x; i++) {
                r = JSBI.multiply(r, JSBI.BigInt(i));
            }
            return new Sk.builtin.int_(r);
        }
    }

    const s_floor = new pyStr("__floor__");

    function floor(x) {
        let _x;
        if (x.ob$type === pyFloat) {
            _x = x.v;
        } else {
            const method = lookupSpecial(x, s_floor);
            if (method !== undefined) {
                return pyCallOrSuspend(method);
            }
            pyCheckType("x", "number", checkNumber(x));
            _x = Sk.builtin.asnum$(x);
        }
        return new pyInt(Math.floor(_x));
    }

    function fmod(x, y) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        Sk.builtin.pyCheckType("y", "number", Sk.builtin.checkNumber(y));
        let _x = x.v;
        let _y = y.v;
        if (typeof _x !== "number") {
            _x = x.nb$float().v;
        }
        if (typeof _y !== "number") {
            _y = y.nb$float().v;
        }

        if ((_y == Infinity || _y == -Infinity) && isFinite(_x)) {
            return new Sk.builtin.float_(_x);
        }
        const r = _x % _y;
        if (isNaN(r)) {
            if (!isNaN(_x) && !isNaN(_y)) {
                throw new Sk.builtin.ValueError("math domain error");
            }
        }
        return new Sk.builtin.float_(r);
    }

    function frexp(x) {
        //  algorithm taken from https://locutus.io/c/math/frexp/
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        const arg = Sk.builtin.asnum$(x);
        const res = [arg, 0];

        if (arg !== 0 && Number.isFinite(arg)) {
            const absArg = Math.abs(arg);
            let exp = Math.max(-1023, Math.floor(Math.log2(absArg)) + 1);
            let m = absArg * Math.pow(2, -exp);
            // These while loops compensate for rounding errors that sometimes occur because of ECMAScript's Math.log2's undefined precision
            // and also works around the issue of Math.pow(2, -exp) === Infinity when exp <= -1024
            while (m < 0.5) {
                m *= 2;
                exp--;
            }
            while (m >= 1) {
                m *= 0.5;
                exp++;
            }
            if (arg < 0) {
                m = -m;
            }
            res[0] = m;
            res[1] = exp;
        }
        res[0] = new Sk.builtin.float_(res[0]);
        res[1] = new Sk.builtin.int_(res[1]);
        return new Sk.builtin.tuple(res);
    }

    function fsum(iter) {
        // algorithm from https://code.activestate.com/recipes/393090/
        // as well as https://github.com/brython-dev/brython/blob/master/www/src/libs/js
        if (!Sk.builtin.checkIterable(iter)) {
            throw new Sk.builtin.TypeError(
                "'" + Sk.abstr.typeName(iter) + "' object is not iterable"
            );
        }

        let partials = [];
        iter = Sk.abstr.iter(iter);
        let i, hi, lo;
        for (
            let x = iter.tp$iternext();
            x !== undefined;
            x = iter.tp$iternext()
        ) {
            Sk.builtin.pyCheckType(
                "",
                "real number",
                Sk.builtin.checkNumber(x)
            );
            i = 0;
            let _x = x.v;
            if (typeof _x !== "number") {
                _x = x.nb$float().v;
            }
            x = _x;
            for (let j = 0, len = partials.length; j < len; j++) {
                let y = partials[j];
                if (Math.abs(x) < Math.abs(y)) {
                    let temp = x;
                    x = y;
                    y = temp;
                }
                hi = x + y;
                lo = y - (hi - x);
                if (lo) {
                    partials[i] = lo;
                    i++;
                }
                x = hi;
            }
            partials = partials.slice(0, i).concat([x]);
        }
        const sum = partials.reduce(function (a, b) {
            return a + b;
        }, 0);

        return new Sk.builtin.float_(sum);
    }

    function _gcd_internal(_a, _b) {
        function _gcd(a, b) {
            if (b == 0) {
                return a;
            }
            return _gcd(b, a % b);
        }

        function _biggcd(a, b) {
            if (JSBI.equal(b, JSBI.__ZERO)) {
                return a;
            }
            return _biggcd(b, JSBI.remainder(a, b));
        }

        let res;
        if (typeof _a === "number" && typeof _b === "number") {
            _a = Math.abs(_a);
            _b = Math.abs(_b);
            res = _gcd(_a, _b);
            res = res < 0 ? -res : res; // python only returns positive gcds
        } else {
            _a = JSBI.BigInt(_a);
            _b = JSBI.BigInt(_b);
            res = _biggcd(_a, _b);
            if (JSBI.lessThan(res, JSBI.__ZERO)) {
                res = JSBI.multiply(res, JSBI.BigInt(-1));
            }
        }

        return res;
    }

    function gcd(a, b) {
        // non ints not allowed in python 3.7.x
        Sk.builtin.pyCheckType("a", "integer", Sk.builtin.checkInt(a));
        Sk.builtin.pyCheckType("b", "integer", Sk.builtin.checkInt(b));

        let _a = Sk.builtin.asnum$(a);
        let _b = Sk.builtin.asnum$(b);

        const res = _gcd_internal(_a, _b);
        // res is positive
        if (typeof res === "number") {
            return new Sk.builtin.int_(res);
        } else {
            return new Sk.builtin.int_(res.toString());
            // this is a bit of a hack - we're being lazy and passing a string to int_
            // the int constructor will then decide if it should be a number or a BigInt depending on the size.
            // really we should do:
            // return  JSBI.lessThanOrEqual(res, JSBI.BigInt(Number.MAX_SAFE_INTEGER)) ? new Sk.builtin.int_(Number(res)) : new Sk.builtin.int_(res);
        }
    }

    function isclose(args, kwargs) {
        Sk.abstr.checkArgsLen("isclose", args, 2, 2);
        const rel_abs_vals = Sk.abstr.copyKeywordsToNamedArgs(
            "isclose",
            ["rel_tol", "abs_tol"],
            [],
            kwargs,
            [new Sk.builtin.float_(1e-9), new Sk.builtin.float_(0.0)]
        );

        const a = args[0];
        const b = args[1];
        const rel_tol = rel_abs_vals[0];
        const abs_tol = rel_abs_vals[1];

        Sk.builtin.pyCheckType("a", "number", Sk.builtin.checkNumber(a));
        Sk.builtin.pyCheckType("b", "number", Sk.builtin.checkNumber(b));
        Sk.builtin.pyCheckType(
            "rel_tol",
            "number",
            Sk.builtin.checkNumber(rel_tol)
        );
        Sk.builtin.pyCheckType(
            "abs_tol",
            "number",
            Sk.builtin.checkNumber(abs_tol)
        );

        const _a = Sk.builtin.asnum$(a);
        const _b = Sk.builtin.asnum$(b);
        const _rel_tol = Sk.builtin.asnum$(rel_tol);
        const _abs_tol = Sk.builtin.asnum$(abs_tol);

        if (_rel_tol < 0.0 || _abs_tol < 0.0) {
            throw new Sk.builtin.ValueError("tolerances must be non-negative");
        }
        if (_a == _b) {
            return Sk.builtin.bool.true$;
        }

        if (
            _a == Infinity ||
            _a == -Infinity ||
            _b == Infinity ||
            _b == -Infinity
        ) {
            // same sign infinities were caught in previous test
            return Sk.builtin.bool.false$;
        }
        const diff = Math.abs(_b - _a);
        const res =
            diff <= Math.abs(_rel_tol * _b) ||
            diff <= Math.abs(_rel_tol * _a) ||
            diff <= _abs_tol;
        return new Sk.builtin.bool(res);
    }

    function isfinite(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        const _x = Sk.builtin.asnum$(x);
        if (Sk.builtin.checkInt(x)) {
            return Sk.builtin.bool.true$; //deals with big integers returning False
        } else if (isFinite(_x)) {
            return Sk.builtin.bool.true$;
        } else {
            return Sk.builtin.bool.false$;
        }
    }

    function isinf(x) {
        /* Return True if x is infinite or nan, and False otherwise. */
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        const _x = Sk.builtin.asnum$(x);
        if (Sk.builtin.checkInt(x)) {
            return Sk.builtin.bool.false$; //deals with big integers returning True
        } else if (isFinite(_x) || isNaN(_x)) {
            return Sk.builtin.bool.false$;
        } else {
            return Sk.builtin.bool.true$;
        }
    }

    function isnan(x) {
        // Return True if x is a NaN (not a number), and False otherwise.
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        const _x = Sk.builtin.asnum$(x);
        if (isNaN(_x)) {
            return Sk.builtin.bool.true$;
        } else {
            return Sk.builtin.bool.false$;
        }
    }

    function bigint_isqrt(n_js) {
        // Algorithm taken from:
        // https://github.com/python/cpython/blob/main/Modules/mathmodule.c#L1598-L1618
        let c = n_js.toString(2).length; // bitlength of a positive bigint
        c = Math.floor((c - 1) / 2);
        let s = c.toString(2).length; // bitlength
        const one = JSBI.BigInt(1);
        const two = JSBI.BigInt(2);
        const cBigInt = JSBI.BigInt(c);
        const twoC = JSBI.multiply(two, cBigInt);
        let a = one;
        let d = JSBI.BigInt(0);
        while (s > 0) {
            s--;
            let e = d;
            d = JSBI.signedRightShift(cBigInt, JSBI.BigInt(s));
            const leftShiftAmount = JSBI.subtract(JSBI.subtract(d, e), one);
            const leftPart = JSBI.leftShift(a, leftShiftAmount);
            const rightShiftAmount = JSBI.add(
                JSBI.subtract(JSBI.subtract(twoC, e), d),
                one
            );
            const rightPart = JSBI.signedRightShift(n_js, rightShiftAmount);
            a = JSBI.add(leftPart, JSBI.divide(rightPart, a));
        }
        let res = a;
        if (JSBI.greaterThan(JSBI.multiply(res, res), n_js)) {
            res = JSBI.subtract(res, one);
        }
        if (JSBI.lessThanOrEqual(res, JSBI.BigInt(Number.MAX_SAFE_INTEGER))) {
            res = Number(res);
        }
        return new Sk.builtin.int_(res);
    }

    function isqrt(n) {
        let n_js = Sk.misceval.asIndexOrThrow(n);
        if (n_js < 0) {
            throw new Sk.builtin.ValueError(
                "isqrt() argument must be nonnegative"
            );
        }
        if (n_js == 0) {
            return new Sk.builtin.int_(0);
        }
        if (typeof n_js === "number") {
            return new Sk.builtin.int_(Math.floor(Math.sqrt(n_js)));
        }
        return bigint_isqrt(n_js);
    }

    function lcm(...args) {
        function abs(n) {
            if (typeof n === "number") {
                return new Sk.builtin.int_(Math.abs(n));
            }

            return JSBI.lessThan(n, JSBI.__ZERO)
                ? new Sk.builtin.int_(JSBI.unaryMinus(n))
                : new Sk.builtin.int_(n);
        }

        const nargs = args.length;

        // lcm() without arguments returns 1
        if (nargs === 0) return new Sk.builtin.int_(1);

        // Test & convert all arguments
        let i;
        for (i = 0; i < nargs; ++i) {
            args[i] = Sk.misceval.asIndexOrThrow(args[i]);
        }

        let result = args[0];
        if (nargs === 1) {
            return abs(result);
        }

        let arg;
        for (i = 1; i < nargs; ++i) {
            arg = args[i];

            // If any of the arguments is zero, then the returned value is 0
            if (arg === 0) return new Sk.builtin.int_(0);

            if (typeof result === "number" && typeof arg === "number") {
                let tmp = (result / _gcd_internal(result, arg)) * arg;
                tmp = Math.abs(tmp);

                // check the size - if we're too big reset the result and then fall through
                result =
                    tmp > Number.MAX_SAFE_INTEGER ? JSBI.BigInt(result) : tmp;
            } else {
                result = JSBI.BigInt(result);
            }

            // allow fall through - if result gets too big we'll need to redo the calculation with BigInts
            if (typeof result !== "number") {
                arg = JSBI.BigInt(arg);
                result = JSBI.multiply(
                    JSBI.divide(result, _gcd_internal(result, arg)),
                    arg
                );
            }
        }

        return abs(result);
    }

    function ldexp(x, i) {
        // return x * (2**i)
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        Sk.builtin.pyCheckType("i", "integer", Sk.builtin.checkInt(i));

        let _x = x.v;
        if (typeof _x !== "number") {
            _x = x.nb$float().v;
        }
        const _i = Sk.builtin.asnum$(i);

        if (_x == Infinity || _x == -Infinity || _x == 0 || isNaN(_x)) {
            return new Sk.builtin.float_(_x);
        }
        const res = _x * Math.pow(2, _i);
        if (!isFinite(res)) {
            throw new Sk.builtin.OverflowError("math range error");
        }
        return new Sk.builtin.float_(res);
    }

    function modf(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        let _x = Sk.builtin.asnum$(x);
        if (!isFinite(_x)) {
            //special cases
            if (_x == Infinity) {
                return new Sk.builtin.tuple([
                    new Sk.builtin.float_(0.0),
                    new Sk.builtin.float_(_x),
                ]);
            } else if (_x == -Infinity) {
                return new Sk.builtin.tuple([
                    new Sk.builtin.float_(-0.0),
                    new Sk.builtin.float_(_x),
                ]);
            } else if (isNaN(_x)) {
                return new Sk.builtin.tuple([
                    new Sk.builtin.float_(_x),
                    new Sk.builtin.float_(_x),
                ]);
            }
        }
        const sign = get_sign(_x);
        _x = Math.abs(_x);
        const i = sign * Math.floor(_x); //integer part
        const d = sign * (_x - Math.floor(_x)); //decimal part

        return new Sk.builtin.tuple([
            new Sk.builtin.float_(d),
            new Sk.builtin.float_(i),
        ]);
    }

    function perm(n, k) {
        if (k === undefined || Sk.builtin.checkNone(k)) {
            return factorial(n);
        }
        n = Sk.misceval.asIndexOrThrow(n);
        k = Sk.misceval.asIndexOrThrow(k);
        if (n < 0) {
            throw new Sk.builtin.ValueError(
                "n must be an non-negative integer"
            );
        }
        if (k < 0) {
            throw new Sk.builtin.ValueError("k must be a non-negative integer");
        }
        if (k > n) {
            return new Sk.builtin.int_(0);
        }
        if (k === 0) {
            return new Sk.builtin.int_(1);
        }
        if (k > Number.MAX_SAFE_INTEGER) {
            throw new Sk.builtin.OverflowError(
                "k must not exceed " + Number.MAX_SAFE_INTEGER
            );
        }
        const one = new Sk.builtin.int_(1);
        n = new Sk.builtin.int_(n);
        let tot = n;
        for (let i = 1; i < k; i++) {
            n = n.nb$subtract(one);
            tot = tot.nb$multiply(n);
        }
        return tot;
    }

    function prod(args, kwargs) {
        Sk.abstr.checkArgsLen("prod", args, 1, 1);
        args = Sk.abstr.copyKeywordsToNamedArgs(
            "prod",
            [null, "start"],
            args,
            kwargs,
            [new Sk.builtin.int_(1)]
        );

        const it = Sk.abstr.iter(args[0]);
        let tot = args[1];

        function fastProdInt() {
            return Sk.misceval.iterFor(it, (i) => {
                if (i.constructor === Sk.builtin.int_) {
                    tot = tot.nb$multiply(i);
                } else if (i.constructor === Sk.builtin.float_) {
                    tot = tot.nb$float().nb$multiply(i);
                    return new Sk.misceval.Break("float");
                } else {
                    tot = Sk.abstr.numberBinOp(tot, i, "Mult");
                    return new Sk.misceval.Break("slow");
                }
            });
        }

        function fastProdFloat() {
            return Sk.misceval.iterFor(it, (i) => {
                if (
                    i.constructor === Sk.builtin.float_ ||
                    i.constructor === Sk.builtin.int_
                ) {
                    tot = tot.nb$multiply(i);
                } else {
                    tot = Sk.abstr.numberBinOp(tot, i, "Mult");
                    return new Sk.misceval.Break("slow");
                }
            });
        }

        function slowProd() {
            return Sk.misceval.iterFor(it, (i) => {
                tot = Sk.abstr.numberBinOp(tot, i, "Mult");
            });
        }

        let prodType;
        if (tot.constructor === Sk.builtin.int_) {
            prodType = fastProdInt();
        } else if (tot.constructor === Sk.builtin.float_) {
            prodType = "float";
        } else {
            prodType = "slow";
        }

        return Sk.misceval.chain(
            prodType,
            (prodType) => {
                if (prodType === "float") {
                    return fastProdFloat();
                }
                return prodType;
            },
            (prodType) => {
                if (prodType === "slow") {
                    return slowProd();
                }
            },
            () => tot
        );
    }

    function remainder(x, y) {
        // as per cpython algorithm see cpython for details
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        Sk.builtin.pyCheckType("y", "number", Sk.builtin.checkNumber(y));

        let _x = x.v;
        let _y = y.v;
        if (typeof _x !== "number") {
            _x = x.nb$float().v;
        }
        if (typeof _y !== "number") {
            _y = y.nb$float().v;
        }

        // deal with most common cases first
        if (isFinite(_x) && isFinite(_y)) {
            let absx, absy, c, m, r;
            if (_y == 0.0) {
                throw new Sk.builtin.ValueError("math domain error");
            }
            absx = Math.abs(_x);
            absy = Math.abs(_y);
            m = absx % absy;
            c = absy - m;
            if (m < c) {
                r = m;
            } else if (m > c) {
                r = -c;
            } else {
                if (m != c) {
                    throw new Sk.builtin.AssertionError();
                }
                r = m - 2.0 * ((0.5 * (absx - m)) % absy);
            }
            return new Sk.builtin.float_(get_sign(_x) * r);
        }
        /* Special values. */
        if (isNaN(_x)) {
            return x;
        }
        if (isNaN(_y)) {
            return y;
        }
        if (_x == Infinity || _x == -Infinity) {
            throw new Sk.builtin.ValueError("math domain error");
        }
        if (!(_y == Infinity || _y == -Infinity)) {
            throw new Sk.builtin.AssertionError();
        }
        return new Sk.builtin.float_(_x);
    }

    function trunc(x) {
        if (x.ob$type === pyFloat) {
            return x.nb$int();
        }
        const truncFn = lookupSpecial(x, pyStr.$trunc);
        if (truncFn === undefined) {
            throw new pyTypeError(
                `type ${x.tp$name} doesn't define __trunc__ method`
            );
        }
        return pyCallOrSuspend(truncFn);
    }

    // Power and logarithmic functions
    function exp(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        let _x = x.v;
        if (typeof _x !== "number") {
            _x = x.nb$float().v;
        }
        if (_x == Infinity || _x == -Infinity || isNaN(_x)) {
            return new Sk.builtin.float_(Math.exp(_x));
        }
        const res = Math.exp(_x);
        if (!isFinite(res)) {
            throw new Sk.builtin.OverflowError("math range error");
        }

        return new Sk.builtin.float_(res);
    }

    function expm1(x) {
        // as per python docs this implements an algorithm for evaluating exp(x) - 1
        // for smaller values of x
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        const _x = Sk.builtin.asnum$(x);

        if (Math.abs(_x) < 0.7) {
            const _u = Math.exp(_x);
            if (_u == 1.0) {
                return new Sk.builtin.float_(_x);
            } else {
                const res = ((_u - 1.0) * _x) / Math.log(_u);
                return new Sk.builtin.float_(res);
            }
        } else {
            const res = Math.exp(_x) - 1.0;
            return new Sk.builtin.float_(res);
        }
    }

    function log(x, base) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        let _x = Sk.builtin.asnum$(x);
        let _base, res;
        if (_x <= 0) {
            throw new Sk.builtin.ValueError("math domain error");
        }
        if (base === undefined) {
            _base = Math.E;
        } else {
            Sk.builtin.pyCheckType(
                "base",
                "number",
                Sk.builtin.checkNumber(base)
            );
            _base = Sk.builtin.asnum$(base);
        }

        if (_base <= 0) {
            throw new Sk.builtin.ValueError("math domain error");
        } else if (Sk.builtin.checkFloat(x) || _x < Number.MAX_SAFE_INTEGER) {
            res = Math.log(_x) / Math.log(_base);
        } else {
            //int that is larger than max safe integer
            // use idea x = 123456789 = .123456789 * 10**9
            // log(x)  = 9 * log(10) + log(.123456789)
            _x = new Sk.builtin.str(x).$jsstr();
            const digits = _x.length;
            const decimal = parseFloat("0." + _x);
            res = (digits * Math.log(10) + Math.log(decimal)) / Math.log(_base);
        }
        return new Sk.builtin.float_(res);
    }

    function log1p(x) {
        // as per python docs this is an algorithm for evaluating log 1+x (base e)
        // designed to be more accurate close to 0
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        let _x = x.v;
        if (typeof _x !== "number") {
            _x = x.nb$float().v;
        }

        if (_x <= -1.0) {
            throw new Sk.builtin.ValueError("math domain error");
        } else if (_x == 0) {
            return new Sk.builtin.float_(_x); // respects log1p(-0.0) return -0.0
        } else if (Math.abs(_x) < Number.EPSILON / 2) {
            return new Sk.builtin.float_(_x);
        } else if (-0.5 <= _x && _x <= 1) {
            const _y = 1 + _x;
            const res = Math.log(_y) - (_y - 1 - _x) / _y;
            return new Sk.builtin.float_(res);
        } else {
            const res = Math.log(1 + _x);
            return new Sk.builtin.float_(res);
        }
    }

    function log2(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        let _x = Sk.builtin.asnum$(x);
        let res;
        if (_x <= 0) {
            throw new Sk.builtin.ValueError("math domain error");
        } else if (Sk.builtin.checkFloat(x) || _x < Number.MAX_SAFE_INTEGER) {
            res = Math.log2(_x);
        } else {
            //int that is larger than max safe integer
            // use idea x = 123456789 = .123456789 * 10**9
            // log2(x)  = 9 * log2(10) + log2(.123456789)
            _x = new Sk.builtin.str(x).$jsstr();
            const digits = _x.length;
            const decimal = parseFloat("0." + _x);
            res = digits * Math.log2(10) + Math.log2(decimal);
        }
        return new Sk.builtin.float_(res);
    }

    function log10(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        let _x = Sk.builtin.asnum$(x);
        let res;
        if (_x <= 0) {
            throw new Sk.builtin.ValueError("math domain error");
        } else if (Sk.builtin.checkFloat(x) || _x < Number.MAX_SAFE_INTEGER) {
            res = Math.log10(_x);
        } else {
            //int that is larger than max safe integer
            // use idea x = 123456789 = .123456789 * 10**9
            // log10(x)  = 9 + log10(.123456789)
            _x = new Sk.builtin.str(x).$jsstr();
            const digits = _x.length;
            const decimal = parseFloat("0." + _x);
            res = digits + Math.log10(decimal);
        }
        return new Sk.builtin.float_(res);
    }

    function pow(x, y) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        Sk.builtin.pyCheckType("y", "number", Sk.builtin.checkNumber(y));

        let _x = x.v;
        let _y = y.v;
        if (typeof _x !== "number") {
            _x = x.nb$float().v;
        }
        if (typeof _y !== "number") {
            _y = y.nb$float().v;
        }

        if (_x == 0 && _y < 0) {
            throw new Sk.builtin.ValueError("math domain error");
        } else if (_x == 1) {
            return new Sk.builtin.float_(1.0);
        } else if (
            Number.isFinite(_x) &&
            Number.isFinite(_y) &&
            _x < 0 &&
            !Number.isInteger(_y)
        ) {
            throw new Sk.builtin.ValueError("math domain error");
        } else if (_x == -1 && (_y == -Infinity || _y == Infinity)) {
            return new Sk.builtin.float_(1.0);
        }

        const res = Math.pow(_x, _y);
        if (!Number.isFinite(_x) || !Number.isFinite(_y)) {
            return new Sk.builtin.float_(res);
        } else if (res == Infinity || res == -Infinity) {
            throw new Sk.builtin.OverflowError("math range error");
        }
        return new Sk.builtin.float_(res);
    }

    function sqrt(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        const _x = Sk.builtin.asnum$(x);
        if (_x < 0) {
            throw new Sk.builtin.ValueError("math domain error");
        }
        return new Sk.builtin.float_(Math.sqrt(_x));
    }

    // Trigonometric functions and Hyperbolic

    function asin(rad) {
        Sk.builtin.pyCheckType("rad", "number", Sk.builtin.checkNumber(rad));

        return new Sk.builtin.float_(Math.asin(Sk.builtin.asnum$(rad)));
    }

    function acos(rad) {
        Sk.builtin.pyCheckType("rad", "number", Sk.builtin.checkNumber(rad));

        return new Sk.builtin.float_(Math.acos(Sk.builtin.asnum$(rad)));
    }

    function atan(rad) {
        Sk.builtin.pyCheckType("rad", "number", Sk.builtin.checkNumber(rad));

        return new Sk.builtin.float_(Math.atan(Sk.builtin.asnum$(rad)));
    }

    function atan2(y, x) {
        Sk.builtin.pyCheckType("y", "number", Sk.builtin.checkNumber(y));
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        return new Sk.builtin.float_(
            Math.atan2(Sk.builtin.asnum$(y), Sk.builtin.asnum$(x))
        );
    }

    function sin(rad) {
        Sk.builtin.pyCheckType("rad", "number", Sk.builtin.checkNumber(rad));

        return new Sk.builtin.float_(Math.sin(Sk.builtin.asnum$(rad)));
    }

    function cos(rad) {
        Sk.builtin.pyCheckType("rad", "number", Sk.builtin.checkNumber(rad));

        return new Sk.builtin.float_(Math.cos(Sk.builtin.asnum$(rad)));
    }

    function tan(rad) {
        Sk.builtin.pyCheckType("rad", "number", Sk.builtin.checkNumber(rad));

        return new Sk.builtin.float_(Math.tan(Sk.builtin.asnum$(rad)));
    }

    function dist(x) {
        throw new Sk.builtin.NotImplementedError(
            "math.dist() is not yet implemented in Skulpt"
        );
    }

    function hypot(x, y) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));
        Sk.builtin.pyCheckType("y", "number", Sk.builtin.checkNumber(y));

        x = Sk.builtin.asnum$(x);
        y = Sk.builtin.asnum$(y);
        return new Sk.builtin.float_(Math.sqrt(x * x + y * y));
    }

    function asinh(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        x = Sk.builtin.asnum$(x);

        const L = x + Math.sqrt(x * x + 1);

        return new Sk.builtin.float_(Math.log(L));
    }

    function acosh(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        x = Sk.builtin.asnum$(x);

        const L = x + Math.sqrt(x * x - 1);

        return new Sk.builtin.float_(Math.log(L));
    }

    function atanh(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        x = Sk.builtin.asnum$(x);

        const L = (1 + x) / (1 - x);

        return new Sk.builtin.float_(Math.log(L) / 2);
    }

    function sinh(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        x = Sk.builtin.asnum$(x);

        const e = Math.E;
        const p = Math.pow(e, x);
        const n = 1 / p;
        const result = (p - n) / 2;

        return new Sk.builtin.float_(result);
    }

    function cosh(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        x = Sk.builtin.asnum$(x);

        const e = Math.E;
        const p = Math.pow(e, x);
        const n = 1 / p;
        const result = (p + n) / 2;

        return new Sk.builtin.float_(result);
    }

    function tanh(x) {
        Sk.builtin.pyCheckType("x", "number", Sk.builtin.checkNumber(x));

        const _x = Sk.builtin.asnum$(x);

        if (_x === 0) {
            return new Sk.builtin.float_(_x);
        }

        const e = Math.E;
        const p = Math.pow(e, _x);
        const n = 1 / p;
        const result = (p - n) / 2 / ((p + n) / 2);

        return new Sk.builtin.float_(result);
    }

    // Angular Conversion
    function radians(deg) {
        Sk.builtin.pyCheckType("deg", "number", Sk.builtin.checkNumber(deg));

        const ret = (Math.PI / 180.0) * Sk.builtin.asnum$(deg);
        return new Sk.builtin.float_(ret);
    }

    function degrees(rad) {
        Sk.builtin.pyCheckType("rad", "number", Sk.builtin.checkNumber(rad));

        const ret = (180.0 / Math.PI) * Sk.builtin.asnum$(rad);
        return new Sk.builtin.float_(ret);
    }

    // Special Functions
    function erf(x) {
        throw new Sk.builtin.NotImplementedError(
            "math.erf() is not yet implemented in Skulpt"
        );
    }

    function erfc(x) {
        throw new Sk.builtin.NotImplementedError(
            "math.erfc() is not yet implemented in Skulpt"
        );
    }

    function gamma(x) {
        throw new Sk.builtin.NotImplementedError(
            "math.gamma() is not yet implemented in Skulpt"
        );
    }

    function lgamma(x) {
        throw new Sk.builtin.NotImplementedError(
            "math.lgamma() is not yet implemented in Skulpt"
        );
    }

    Sk.abstr.setUpModuleMethods("math", math, {
        acos: {
            $meth: acos,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the arc cosine (measured in radians) of x.",
        },
        acosh: {
            $meth: acosh,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the inverse hyperbolic cosine of x.",
        },
        asin: {
            $meth: asin,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the arc sine (measured in radians) of x.",
        },
        asinh: {
            $meth: asinh,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the inverse hyperbolic sine of x.",
        },
        atan: {
            $meth: atan,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the arc tangent (measured in radians) of x.",
        },
        atan2: {
            $meth: atan2,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, y, x, /)",
            $doc: "Return the arc tangent (measured in radians) of y/x.\n\nUnlike atan(y/x), the signs of both x and y are considered.",
        },
        atanh: {
            $meth: atanh,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the inverse hyperbolic tangent of x.",
        },
        ceil: {
            $meth: ceil,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the ceiling of x as an Integral.\n\nThis is the smallest integer >= x.",
        },
        comb: {
            $meth: comb,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, n, k=None, /)",
            $doc: "Number of ways to choose k items from n items without repetition and with order.\n\nEvaluates to n! / (n - k)! when k <= n and evaluates\nto zero when k > n.\n\nIf k is not specified or is None, then k defaults to n\nand the function returns n!.\n\nRaises TypeError if either of the arguments are not integers.\nRaises ValueError if either of the arguments are negative.",
        },
        copysign: {
            $meth: copysign,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, x, y, /)",
            $doc: "Return a float with the magnitude (absolute value) of x but the sign of y.\n\nOn platforms that support signed zeros, copysign(1.0, -0.0)\nreturns -1.0.\n",
        },
        cos: {
            $meth: cos,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the cosine of x (measured in radians).",
        },
        cosh: {
            $meth: cosh,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the hyperbolic cosine of x.",
        },
        degrees: {
            $meth: degrees,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Convert angle x from radians to degrees.",
        },
        dist: {
            $meth: dist,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, p, q, /)",
            $doc: "Return the Euclidean distance between 2 points in any dimension.",
        },
        erf: {
            $meth: erf,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Error function at x.",
        },
        erfc: {
            $meth: erfc,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Complementary error function at x.",
        },
        exp: {
            $meth: exp,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return e raised to the power of x.",
        },
        expm1: {
            $meth: expm1,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return exp(x)-1.\n\nThis function avoids the loss of precision involved in the direct evaluation of exp(x)-1 for small x.",
        },
        fabs: {
            $meth: fabs,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the absolute value of the float x.",
        },
        factorial: {
            $meth: factorial,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Find x!.\n\nRaise a ValueError if x is negative or non-integral.",
        },
        floor: {
            $meth: floor,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the floor of x as an Integral.\n\nThis is the largest integer <= x.",
        },
        fmod: {
            $meth: fmod,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, x, y, /)",
            $doc: "Return fmod(x, y), according to platform C.\n\nx % y may differ.",
        },
        frexp: {
            $meth: frexp,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the mantissa and exponent of x, as pair (m, e).\n\nm is a float and e is an int, such that x = m * 2.**e.\nIf x is 0, m and e are both 0.  Else 0.5 <= abs(m) < 1.0.",
        },
        fsum: {
            $meth: fsum,
            $flags: { OneArg: true },
            $textsig: "($module, seq, /)",
            $doc: "Return an accurate floating point sum of values in the iterable seq.\n\nAssumes IEEE-754 floating point arithmetic.",
        },
        gamma: {
            $meth: gamma,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Gamma function at x.",
        },
        gcd: {
            $meth: gcd,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, x, y, /)",
            $doc: "greatest common divisor of x and y",
        },
        hypot: {
            $meth: hypot,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, x, y, /)",
            $doc: "Return the Euclidean distance, sqrt(x*x + y*y).",
        },
        isclose: {
            $meth: isclose,
            $flags: { FastCall: true },
            $textsig: "($module, /, a, b, *, rel_tol=1e-09, abs_tol=0.0)",
            $doc: 'Determine whether two floating point numbers are close in value.\n\n  rel_tol\n    maximum difference for being considered "close", relative to the\n    magnitude of the input values\n  abs_tol\n    maximum difference for being considered "close", regardless of the\n    magnitude of the input values\n\nReturn True if a is close in value to b, and False otherwise.\n\nFor the values to be considered close, the difference between them\nmust be smaller than at least one of the tolerances.\n\n-inf, inf and NaN behave similarly to the IEEE 754 Standard.  That\nis, NaN is not close to anything, even itself.  inf and -inf are\nonly close to themselves.',
        },
        isfinite: {
            $meth: isfinite,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return True if x is neither an infinity nor a NaN, and False otherwise.",
        },
        isinf: {
            $meth: isinf,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return True if x is a positive or negative infinity, and False otherwise.",
        },
        isnan: {
            $meth: isnan,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return True if x is a NaN (not a number), and False otherwise.",
        },
        isqrt: {
            $meth: isqrt,
            $flags: { OneArg: true },
            $textsig: "($module, n, /)",
            $doc: "Return the integer part of the square root of the input.",
        },
        lcm: {
            $meth: lcm,
            $flags: { MinArgs: 0 },
            $textsig: "($module, *integers, /)",
            $doc: "Return the least common multiple of the specified integer arguments. If all arguments are nonzero, then the returned value is the smallest positive integer that is a multiple of all arguments. If any of the arguments is zero, then the returned value is 0. lcm() without arguments returns 1.",
        },
        ldexp: {
            $meth: ldexp,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, x, i, /)",
            $doc: "Return x * (2**i).\n\nThis is essentially the inverse of frexp().",
        },
        lgamma: {
            $meth: lgamma,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Natural logarithm of absolute value of Gamma function at x.",
        },
        log: {
            $meth: log,
            $flags: { MinArgs: 1, MaxArgs: 2 },
            $textsig: null,
            $doc: "log(x, [base=e])\nReturn the logarithm of x to the given base.\n\nIf the base not specified, returns the natural logarithm (base e) of x.",
        },
        log10: {
            $meth: log10,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the base 10 logarithm of x.",
        },
        log1p: {
            $meth: log1p,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the natural logarithm of 1+x (base e).\n\nThe result is computed in a way which is accurate for x near zero.",
        },
        log2: {
            $meth: log2,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the base 2 logarithm of x.",
        },
        modf: {
            $meth: modf,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the fractional and integer parts of x.\n\nBoth results carry the sign of x and are floats.",
        },
        perm: {
            $meth: perm,
            $flags: { MinArgs: 1, MaxArgs: 2 },
            $textsig: "($module, n, k=None, /)",
            $doc: "'Number of ways to choose k items from n items without repetition and with order.\n\nEvaluates to n! / (n - k)! when k <= n and evaluates\nto zero when k > n.\n\nIf k is not specified or is None, then k defaults to n\nand the function returns n!.\n\nRaises TypeError if either of the arguments are not integers.\nRaises ValueError if either of the arguments are negative.'",
        },
        prod: {
            $meth: prod,
            $flags: { FastCall: true },
            $textsig: "($module, iterable, /, *, start=1)",
            $doc: "Calculate the product of all the elements in the input iterable. The default start value for the product is 1.\n\nWhen the iterable is empty, return the start value. This function is intended specifically for use with numeric values and may reject non-numeric types.",
        },
        pow: {
            $meth: pow,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, x, y, /)",
            $doc: "Return x**y (x to the power of y).",
        },
        radians: {
            $meth: radians,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Convert angle x from degrees to radians.",
        },
        remainder: {
            $meth: remainder,
            $flags: { MinArgs: 2, MaxArgs: 2 },
            $textsig: "($module, x, y, /)",
            $doc: "Difference between x and the closest integer multiple of y.\n\nReturn x - n*y where n*y is the closest integer multiple of y.\nIn the case where x is exactly halfway between two multiples of\ny, the nearest even value of n is used. The result is always exact.",
        },
        sin: {
            $meth: sin,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the sine of x (measured in radians).",
        },
        sinh: {
            $meth: sinh,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the hyperbolic sine of x.",
        },
        sqrt: {
            $meth: sqrt,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the square root of x.",
        },
        tan: {
            $meth: tan,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the tangent of x (measured in radians).",
        },
        tanh: {
            $meth: tanh,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Return the hyperbolic tangent of x.",
        },
        trunc: {
            $meth: trunc,
            $flags: { OneArg: true },
            $textsig: "($module, x, /)",
            $doc: "Truncates the Real x to the nearest Integral toward 0.\n\nUses the __trunc__ magic method.",
        },
    });

    return math;
};
