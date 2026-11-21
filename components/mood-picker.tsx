import { MOOD_OPTIONS } from "@/lib/entries";
import styles from "./mood-picker.module.css";

const choices = [{ value: "", label: "不标注" }, ...MOOD_OPTIONS];

type MoodPickerProps = {
  value: string;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
};

export function MoodPicker({ value, disabled, error, onChange }: MoodPickerProps) {
  return (
    <fieldset id="entry-mood" className={styles.field} disabled={disabled}
      aria-invalid={Boolean(error)} aria-describedby={error ? "entry-mood-error" : undefined}>
      <legend className={`field-label ${styles.legend}`}>情绪</legend>
      <div className={styles.choices}>
        {choices.map(option => (
          <label key={option.value} className={styles.choice}>
            <input type="radio" name="mood" value={option.value} checked={value === String(option.value)}
              onChange={event => onChange(event.currentTarget.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="field-error" id="entry-mood-error">{error}</p>}
    </fieldset>
  );
}
