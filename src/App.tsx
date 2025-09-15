import { useEffect, useRef, useState } from "react";
import "./App.css";

const STATES = {
    WAIT: "WAIT",
    WALK: "WALK",
} as const;

const DEFAULTS = {
    wait: 8,
    walk: 10,
};

type Durations = {
    wait: number;
    walk: number;
};

function useInterval(callback: () => void, delay: number | null) {
    const savedRef = useRef(callback);
    useEffect(() => {
        savedRef.current = callback;
    }, [callback]);
    useEffect(() => {
        if (delay === null) return;
        const id = setInterval(() => savedRef.current(), delay);
        return () => clearInterval(id);
    }, [delay]);
}

function useBeep({ muted }: { muted: boolean }) {
    const ctxRef = useRef<AudioContext | null>(null);
    const canPlay = !muted;
    const ensureCtx = () => {
        if (!ctxRef.current) {
            const Ctor =
                (window as any).AudioContext || (window as any).webkitAudioContext;
            if (Ctor) ctxRef.current = new Ctor();
        }
        return ctxRef.current;
    };
    const beep = (freq = 880, ms = 90, gain = 0.08) => {
        if (!canPlay) return;
        const ctx = ensureCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.value = gain;
        osc.connect(g);
        g.connect(ctx.destination);
        const now = ctx.currentTime;
        osc.start(now);
        osc.stop(now + ms / 1000);
    };
    return { beep };
}

function LedMatrix({
                       active,
                       color,
                       pattern,
                   }: {
    active: boolean;
    color: string;
    pattern: number[][];
}) {
    return (
        <div className="led-matrix">
            {pattern.map((row, ri) => (
                <div key={ri} className="led-row">
                    {row.map((c, ci) => (
                        <div
                            key={ci}
                            className={`led-dot ${c ? (active ? color : "off") : "off"}`}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

function LedDigit({
                      num,
                      color,
                      active,
                  }: {
    num: number;
    color: string;
    active: boolean;
}) {
    const DIGITS: Record<string, number[][]> = {
        "0": [
            [1, 1, 1],
            [1, 0, 1],
            [1, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
        ],
        "1": [
            [0, 1, 0],
            [1, 1, 0],
            [0, 1, 0],
            [0, 1, 0],
            [1, 1, 1],
        ],
        "2": [
            [1, 1, 1],
            [0, 0, 1],
            [1, 1, 1],
            [1, 0, 0],
            [1, 1, 1],
        ],
        "3": [
            [1, 1, 1],
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 1],
            [1, 1, 1],
        ],
        "4": [
            [1, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 0, 1],
            [0, 0, 1],
        ],
        "5": [
            [1, 1, 1],
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 1],
            [1, 1, 1],
        ],
        "6": [
            [1, 1, 1],
            [1, 0, 0],
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1],
        ],
        "7": [
            [1, 1, 1],
            [0, 0, 1],
            [0, 1, 0],
            [0, 1, 0],
            [0, 1, 0],
        ],
        "8": [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1],
        ],
        "9": [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 0, 1],
            [1, 1, 1],
        ],
    };

    const pattern = DIGITS[String(num)] || DIGITS["0"];
    return (
        <div className="led-digit">
            {pattern.map((row, ri) => (
                <div key={ri} className="led-row">
                    {row.map((c, ci) => (
                        <div
                            key={ci}
                            className={`led-dot ${c ? (active ? color : "off") : "off"}`}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

function Digital({ value, color }: { value: number; color: string }) {
    const str = String(Math.max(0, value)).padStart(2, "0");
    return (
        <div className="digital-led">
            {str.split("").map((d, i) => (
                <LedDigit key={i} num={parseInt(d)} color={color} active={true} />
            ))}
        </div>
    );
}

// Матрица полностью залита
const MAN_PATTERN = Array.from({ length: 7 }, () =>
    Array(7).fill(1)
);

export default function App() {
    const [dur] = useState<Durations>(DEFAULTS);
    const [state, setState] = useState<typeof STATES[keyof typeof STATES]>(
        STATES.WAIT
    );
    const [running, setRunning] = useState(false);
    const [muted, setMuted] = useState(false);
    const [remaining, setRemaining] = useState<number>(dur.wait);

    const { beep } = useBeep({ muted });

    useEffect(() => {
        if (state === STATES.WAIT) setRemaining(dur.wait);
        if (state === STATES.WALK) setRemaining(dur.walk);
    }, [dur, state]);

    // вычисляем скорость: чем меньше remaining, тем быстрее
// вычисляем скорость: чем меньше remaining, тем быстрее
    const delay =
        !running
            ? null
            : remaining > 5
                ? 1000 // первые секунды нормальный темп
                : 500; // последние 5 сек быстрее

    // интервал всегда ровно 1 сек
    useInterval(() => {
        setRemaining((t) => {
            const next = t - 1;

            // звук зависит от оставшегося времени
            if (state === STATES.WALK) {
                if (next > 5) {
                    // первые секунды — 1 звуковой сигнал
                    beep(1200, 80, 0.07);
                } else if (next > 0) {
                    // последние 5 секунд — два быстрых сигнала
                    beep(1400, 60, 0.07);
                    setTimeout(() => beep(1600, 40, 0.06), 200);
                }
            }

            if (next >= 0) return next;

            // переключение фаз
            if (state === STATES.WAIT) {
                setState(STATES.WALK);
                return dur.walk;
            } else {
                setState(STATES.WAIT);
                return dur.wait;
            }
        });
    }, running ? 1000 : null); // ⏱ всегда ровно 1 секунда



    const color = state === STATES.WALK ? "green" : "red";

    return (
        <div className="app">
            <div className="traffic-light">
                <LedMatrix active={state === STATES.WAIT} color="red" pattern={MAN_PATTERN} />
                <LedMatrix active={state === STATES.WALK} color="green" pattern={MAN_PATTERN} />
            </div>

            <Digital value={remaining} color={color} />

            <div className="controls">
                <button onClick={() => setRunning((r) => !r)}>
                    {running ? "Pause" : "Start"}
                </button>
                <button
                    onClick={() => {
                        setRunning(false);
                        setState(STATES.WAIT);
                        setRemaining(dur.wait);
                    }}
                >
                    Reset
                </button>
                <button onClick={() => setMuted((m) => !m)}>
                    {muted ? "Unmute" : "Mute"}
                </button>
            </div>
        </div>
    );
}
