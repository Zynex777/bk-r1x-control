import {
  POLLING_RATES,
  SLEEP_MINUTES,
  SensorFlag,
  type MouseConfig,
  type PollingRate,
} from '../driver/protocol';
import { Field, Panel, Segmented, Toggle, selectClass } from './ui';

/** O app original não expõe o debounce; estes valores são uma faixa conservadora. */
const DEBOUNCE_OPTIONS = [1, 2, 4, 6, 8, 10, 12, 16, 20];

interface PerformanceConfigProps {
  config: MouseConfig;
  isUsb: boolean;
  disabled: boolean;
  onPollingRate: (rate: PollingRate) => void;
  onChange: (patch: Partial<MouseConfig>) => void;
}

export function PerformanceConfig({ config, isUsb, disabled, onPollingRate, onChange }: PerformanceConfigProps) {
  const rate = POLLING_RATES[config.pollingRateIndex] ?? 1000;
  const hasFlag = (flag: number) => (config.sensorFlags & flag) !== 0;
  const setFlag = (flag: number, on: boolean) =>
    onChange({ sensorFlags: on ? config.sensorFlags | flag : config.sensorFlags & ~flag });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Polling rate" subtitle="Quantas vezes por segundo o mouse envia a posição ao computador.">
        <Segmented
          disabled={disabled}
          value={rate}
          onChange={onPollingRate}
          options={POLLING_RATES.map((r) => ({ label: `${r} Hz`, value: r, disabled: isUsb && r !== 1000 }))}
        />
        {isUsb && <p className="mt-3 text-xs text-muted">No cabo USB o firmware trabalha fixo em 1000 Hz.</p>}
      </Panel>

      <Panel title="Lift-off distance" subtitle="Altura em que o sensor para de rastrear ao levantar o mouse.">
        <Segmented
          disabled={disabled}
          value={config.lod}
          onChange={(lod) => onChange({ lod })}
          options={[
            { label: 'Baixo · 1 mm', value: 1 },
            { label: 'Alto · 2 mm', value: 2 },
          ]}
        />
      </Panel>

      <Panel title="Sensor">
        <div className="space-y-5">
          <Toggle
            disabled={disabled}
            label="Motion Sync"
            description="Sincroniza a leitura do sensor com o polling. Movimento mais consistente, ao custo de um pouco de latência."
            checked={hasFlag(SensorFlag.MotionSync)}
            onChange={(on) => setFlag(SensorFlag.MotionSync, on)}
          />
          <Toggle
            disabled={disabled}
            label="Controle de ondulação"
            description="Suaviza o tremido do sensor em DPI acima de 9000."
            checked={hasFlag(SensorFlag.RippleControl)}
            onChange={(on) => setFlag(SensorFlag.RippleControl, on)}
          />
          <Toggle
            disabled={disabled}
            label="Correção linear (angle snapping)"
            description="Endireita movimentos quase retos. Costuma atrapalhar em jogos de mira."
            checked={hasFlag(SensorFlag.AngleSnapping)}
            onChange={(on) => setFlag(SensorFlag.AngleSnapping, on)}
          />
        </div>
      </Panel>

      <Panel title="Botões e roda">
        <div className="space-y-6">
          <Field
            label="Debounce (atraso de resposta do botão)"
            hint={
              <>
                Valores menores respondem mais rápido, mas podem gerar clique duplo.{' '}
                <span className="text-warn">Experimental: o app oficial não expõe este ajuste.</span>
              </>
            }
          >
            <select
              className={selectClass}
              disabled={disabled}
              value={config.debounceMs}
              onChange={(e) => onChange({ debounceMs: Number(e.target.value) })}
            >
              {[...new Set([...DEBOUNCE_OPTIONS, config.debounceMs])]
                .sort((a, b) => a - b)
                .map((ms) => (
                  <option key={ms} value={ms}>
                    {ms} ms{ms === 2 ? ' (padrão)' : ''}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Direção da roda">
            <Segmented
              disabled={disabled}
              value={config.scrollInverted ? 1 : 0}
              onChange={(v) => onChange({ scrollInverted: v === 1 })}
              options={[
                { label: 'Normal', value: 0 },
                { label: 'Invertida', value: 1 },
              ]}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Energia" subtitle="Válido no modo sem fio.">
        <div className="space-y-5">
          <Field label="Dormir após">
            <select
              className={selectClass}
              disabled={disabled}
              value={config.sleepMinutes}
              onChange={(e) => onChange({ sleepMinutes: Number(e.target.value) })}
            >
              {[...new Set<number>([...SLEEP_MINUTES, config.sleepMinutes])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? 'minuto' : 'minutos'}
                  </option>
                ))}
            </select>
          </Field>
          <Toggle
            disabled={disabled}
            label="Acordar ao mover"
            checked={config.wakeOnMove}
            onChange={(wakeOnMove) => onChange({ wakeOnMove })}
          />
        </div>
      </Panel>
    </div>
  );
}
