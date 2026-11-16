import { useState } from 'react';
import { getSimHost, setSimHost, SIM_HOST_LABELS, type SimHostMode } from './lib/figma/dev';
import { getSimulation, setSimulation, SIM_LABELS, type SimMode } from './lib/simulate';

/**
 * Development-only test switches. Not rendered in production or plugin builds.
 * First: what the (simulated) Figma plugin reports. Second: how the demo provider misbehaves.
 */
export default function DevSwitch() {
  const [host, setHost] = useState<SimHostMode>(getSimHost());
  const [mode, setMode] = useState<SimMode>(getSimulation());
  return (
    <div className="dev-switch">
      <label>
        <span>Simulated Figma host (dev only)</span>
        <select
          value={host}
          onChange={(e) => {
            const next = e.target.value as SimHostMode;
            setSimHost(next);
            setHost(next);
          }}
        >
          {(Object.keys(SIM_HOST_LABELS) as SimHostMode[]).map((m) => (
            <option key={m} value={m}>
              {SIM_HOST_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Demo provider failures (dev only)</span>
        <select
          value={mode}
          onChange={(e) => {
            const next = e.target.value as SimMode;
            setSimulation(next);
            setMode(next);
          }}
        >
          {(Object.keys(SIM_LABELS) as SimMode[]).map((m) => (
            <option key={m} value={m}>
              {SIM_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
