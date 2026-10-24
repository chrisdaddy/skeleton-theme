// Update safety for 1.x (AGENTS.md): compares the theme's schema with the last release's and
// lists every change that could break a merchant's saved JSON when they update.
//
// Never allowed after release:
// - removing or renaming a section, theme block, block type, section setting or theme setting;
// - changing a setting's type;
// - removing a select/radio option (saved values would become invalid);
// - lowering max_blocks, a block limit or a section limit;
// - tightening a range (raising min, lowering max) or changing its step.
// Deprecate instead: keep the setting and hide it with visible_if.

function settingProblems(where, before = [], after = []) {
  const problems = [];
  for (const old of before) {
    const now = after.find((s) => s.id === old.id);
    if (!now) {
      problems.push(`${where}: setting "${old.id}" was removed (keep it and hide it with visible_if)`);
      continue;
    }
    if (now.type !== old.type) problems.push(`${where}: setting "${old.id}" changed type ${old.type} → ${now.type}`);
    for (const option of old.options ?? []) if (!(now.options ?? []).includes(option)) problems.push(`${where}: setting "${old.id}" lost option "${option}"`);
    if (old.type === 'range' && now.type === 'range') {
      if (now.min > old.min) problems.push(`${where}: range "${old.id}" min raised ${old.min} → ${now.min}`);
      if (now.max < old.max) problems.push(`${where}: range "${old.id}" max lowered ${old.max} → ${now.max}`);
      if (now.step !== old.step) problems.push(`${where}: range "${old.id}" step changed ${old.step} → ${now.step}`);
    }
  }
  return problems;
}

function blockProblems(where, before = [], after = []) {
  const problems = [];
  for (const old of before) {
    const now = after.find((b) => b.type === old.type);
    if (!now) {
      problems.push(`${where}: block type "${old.type}" was removed`);
      continue;
    }
    problems.push(...settingProblems(`${where} › block "${old.type}"`, old.settings, now.settings));
    if (old.limit && now.limit && now.limit < old.limit) problems.push(`${where}: block "${old.type}" limit lowered ${old.limit} → ${now.limit}`);
    if (!old.limit && now.limit) problems.push(`${where}: block "${old.type}" got a limit of ${now.limit}`);
  }
  return problems;
}

export function updateSafetyProblems(baseline, current) {
  const problems = [];
  for (const [type, old] of Object.entries(baseline.sections)) {
    const now = current.sections[type];
    const where = `sections/${type}.liquid`;
    if (!now) {
      problems.push(`${where} was removed`);
      continue;
    }
    problems.push(...settingProblems(where, old.settings, now.settings));
    problems.push(...blockProblems(where, old.blocks, now.blocks));
    if (old.max_blocks && now.max_blocks && now.max_blocks < old.max_blocks) problems.push(`${where}: max_blocks lowered ${old.max_blocks} → ${now.max_blocks}`);
    if (!old.max_blocks && now.max_blocks && now.max_blocks < 50) problems.push(`${where}: max_blocks ${now.max_blocks} added (the default was 50)`);
    if (old.limit && now.limit && now.limit < old.limit) problems.push(`${where}: limit lowered ${old.limit} → ${now.limit}`);
    if (!old.limit && now.limit) problems.push(`${where}: a limit of ${now.limit} was added`);
  }
  for (const [type, old] of Object.entries(baseline.blocks)) {
    const now = current.blocks[type];
    const where = `blocks/${type}.liquid`;
    if (!now) {
      problems.push(`${where} was removed`);
      continue;
    }
    problems.push(...settingProblems(where, old.settings, now.settings));
    problems.push(...blockProblems(where, old.blocks, now.blocks));
  }
  problems.push(...settingProblems('config/settings_schema.json', baseline.settings, current.settings));
  for (const preset of baseline.presets ?? []) if (!(current.presets ?? []).includes(preset)) problems.push(`config/settings_data.json: preset "${preset}" was removed`);
  return problems;
}

// "1.0.10" > "1.0.9"
export function compareVersions(a, b) {
  const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === pb[i]) continue;
    if (pa[i] === undefined) return 1; // 1.0.0 > 1.0.0-rc
    if (pb[i] === undefined) return -1;
    return typeof pa[i] === 'number' && typeof pb[i] === 'number' ? pa[i] - pb[i] : String(pa[i]).localeCompare(String(pb[i]));
  }
  return 0;
}
