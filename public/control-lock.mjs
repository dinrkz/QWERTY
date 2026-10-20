// Remember prior disabled states so configuration refreshes cannot strand a form.
export function createControlLock(getControls) {
  let previous = null;
  return locked => {
    if (locked && !previous) {
      previous = new Map([...getControls()].map(control => [control, control.disabled]));
      for (const control of previous.keys()) control.disabled = true;
    } else if (!locked && previous) {
      for (const [control, disabled] of previous) control.disabled = disabled;
      previous = null;
    }
  };
}
