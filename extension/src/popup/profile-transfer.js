import { MAX_PROFILES, STORAGE_SCHEMA_VERSION } from "../shared/constants.js";
import { readProfile, readRule } from "../shared/model.js";

export function createProfilesExport(profiles, exportedAt = new Date()) {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      rules: profile.rules.map(readRule)
    }))
  };
}

export function readProfilesJson(text) {
  const parsed = JSON.parse(text);
  const source = Array.isArray(parsed?.profiles)
    ? parsed.profiles
    : Array.isArray(parsed)
      ? parsed
      : [];

  return source.map(readProfile).filter(Boolean).slice(0, MAX_PROFILES);
}

export function mergeProfiles(currentProfiles, selectedProfiles) {
  const existingNames = new Set(currentProfiles.map((profile) => profile.name.toLowerCase()));
  const newProfiles = selectedProfiles.filter((profile) => !existingNames.has(profile.name.toLowerCase()));
  const availableSlots = MAX_PROFILES - currentProfiles.length;

  if (newProfiles.length > availableSlots) {
    return {
      profiles: currentProfiles,
      error: availableSlots <= 0
        ? "Profile limit reached. Delete a profile before importing new profiles."
        : `You can import ${availableSlots} more ${availableSlots === 1 ? "profile" : "profiles"}.`
    };
  }

  const replacements = new Map(selectedProfiles.map((profile) => [profile.name.toLowerCase(), profile]));
  const replacedProfiles = currentProfiles.map((profile) => {
    const replacement = replacements.get(profile.name.toLowerCase());
    return replacement ? {
      ...profile,
      name: replacement.name,
      rules: replacement.rules.map(readRule)
    } : profile;
  });
  const importedProfiles = newProfiles.map((profile) => ({
    id: crypto.randomUUID(),
    name: profile.name,
    rules: profile.rules.map(readRule)
  }));

  return { profiles: [...replacedProfiles, ...importedProfiles], error: "" };
}
