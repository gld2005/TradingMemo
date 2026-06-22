import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  multiline?: false;
  ref?: Ref<HTMLInputElement>;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  multiline: true;
  ref?: Ref<HTMLTextAreaElement>;
};

export function Input(props: InputProps | TextareaProps) {
  const { label, multiline, className = '', ref, ...controlProps } = props;

  return (
    <label className="field">
      {label ? <span className="field__label">{label}</span> : null}
      {multiline ? (
        <textarea
          className={`input input--multiline ${className}`.trim()}
          ref={ref as Ref<HTMLTextAreaElement>}
          {...(controlProps as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          className={`input ${className}`.trim()}
          ref={ref as Ref<HTMLInputElement>}
          {...(controlProps as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </label>
  );
}
