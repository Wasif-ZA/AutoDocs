import { describe, it, expect } from 'vitest';
import { ComponentExtractor } from '../core/extract.js';

const extractor = new ComponentExtractor();

describe('ComponentExtractor', () => {
  it('extracts basic function component', () => {
    const code = `
      interface ButtonProps {
        /** The button label */
        label: string;
        onClick?: () => void;
        disabled?: boolean;
      }

      export function Button({ label, onClick, disabled = false }: ButtonProps) {
        return <button onClick={onClick} disabled={disabled}>{label}</button>;
      }
    `;

    const result = extractor.extract('Button.tsx', code);

    expect(result.componentName).toBe('Button');
    expect(result.astSuccess).toBe(true);
    expect(result.props).toHaveLength(3);
    expect(result.props[0]).toMatchObject({
      name: 'label',
      type: 'string',
      required: true,
    });
  });

  it('extracts arrow function component', () => {
    const code = `
      interface CardProps {
        title: string;
        children: React.ReactNode;
      }

      export const Card = ({ title, children }: CardProps) => {
        return (
          <div className="card">
            <h2>{title}</h2>
            {children}
          </div>
        );
      };
    `;

    const result = extractor.extract('Card.tsx', code);

    expect(result.componentName).toBe('Card');
    expect(result.astSuccess).toBe(true);
    expect(result.props).toHaveLength(2);
  });

  it('extracts forwardRef component', () => {
    const code = `
      import { forwardRef } from 'react';

      interface InputProps {
        value: string;
        onChange: (value: string) => void;
      }

      export const Input = forwardRef<HTMLInputElement, InputProps>(
        ({ value, onChange }, ref) => {
          return <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} />;
        }
      );
    `;

    const result = extractor.extract('Input.tsx', code);

    expect(result.componentName).toBe('Input');
    expect(result.isForwardRef).toBe(true);
  });

  it('extracts memo component', () => {
    const code = `
      import { memo } from 'react';

      interface ListItemProps {
        text: string;
      }

      export const ListItem = memo(({ text }: ListItemProps) => {
        return <li>{text}</li>;
      });
    `;

    const result = extractor.extract('ListItem.tsx', code);

    expect(result.componentName).toBe('ListItem');
    expect(result.isMemo).toBe(true);
  });

  it('extracts hooks used', () => {
    const code = `
      export function Counter() {
        const [count, setCount] = useState(0);
        const ref = useRef(null);

        useEffect(() => {
          console.log(count);
        }, [count]);

        return <div ref={ref}>{count}</div>;
      }
    `;

    const result = extractor.extract('Counter.tsx', code);

    expect(result.hooks).toContain('useState');
    expect(result.hooks).toContain('useRef');
    expect(result.hooks).toContain('useEffect');
  });

  it('extracts imports correctly', () => {
    const code = `
      import React from 'react';
      import { useState, useEffect } from 'react';
      import { Button } from './Button';
      import * as utils from '../utils';

      export function App() {
        return <div />;
      }
    `;

    const result = extractor.extract('App.tsx', code);

    expect(result.imports).toHaveLength(4);

    const reactImport = result.imports.find(i => i.source === 'react' && i.specifiers.includes('React'));
    expect(reactImport).toBeDefined();
    expect(reactImport?.isRelative).toBe(false);

    const buttonImport = result.imports.find(i => i.source === './Button');
    expect(buttonImport).toBeDefined();
    expect(buttonImport?.isRelative).toBe(true);

    const utilsImport = result.imports.find(i => i.source === '../utils');
    expect(utilsImport).toBeDefined();
    expect(utilsImport?.specifiers).toContain('* as utils');
  });

  it('extracts default export', () => {
    const code = `
      interface Props {
        name: string;
      }

      function Greeting({ name }: Props) {
        return <h1>Hello, {name}!</h1>;
      }

      export default Greeting;
    `;

    const result = extractor.extract('Greeting.tsx', code);

    expect(result.componentName).toBe('Greeting');
    expect(result.exportType).toBe('default');
  });

  it('handles components with no props', () => {
    const code = `
      export function Divider() {
        return <hr className="divider" />;
      }
    `;

    const result = extractor.extract('Divider.tsx', code);

    expect(result.componentName).toBe('Divider');
    expect(result.astSuccess).toBe(true);
    expect(result.props).toHaveLength(0);
  });

  it('handles complex prop types', () => {
    const code = `
      interface ComplexProps {
        size: 'small' | 'medium' | 'large';
        variant?: 'primary' | 'secondary';
        data: { id: number; name: string }[];
        onSelect: (item: { id: number; name: string }) => void;
      }

      export function ComplexComponent(props: ComplexProps) {
        return <div />;
      }
    `;

    const result = extractor.extract('ComplexComponent.tsx', code);

    expect(result.astSuccess).toBe(true);
    expect(result.props).toHaveLength(4);

    const sizeProps = result.props.find(p => p.name === 'size');
    expect(sizeProps?.type).toContain('small');
    expect(sizeProps?.required).toBe(true);

    const variantProp = result.props.find(p => p.name === 'variant');
    expect(variantProp?.required).toBe(false);
  });

  it('handles AST failures gracefully', () => {
    const code = `
      export const Broken = () => {
        return <div>
          {invalid syntax here
        </div>;
      };
    `;

    const result = extractor.extract('Broken.tsx', code);

    expect(result.astSuccess).toBe(false);
    expect(result.astErrors.length).toBeGreaterThan(0);
  });

  it('handles empty file', () => {
    const result = extractor.extract('Empty.tsx', '');

    expect(result.componentName).toBe('');
    expect(result.astErrors).toContain('Could not identify main component export');
  });

  it('handles file with no exports', () => {
    const code = `
      function InternalComponent() {
        return <div />;
      }
    `;

    const result = extractor.extract('Internal.tsx', code);

    expect(result.componentName).toBe('');
    expect(result.astErrors).toContain('Could not identify main component export');
  });
});
