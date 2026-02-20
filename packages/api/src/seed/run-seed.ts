import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { agents, policies, users } from '../db/schema.js';

type SeedPolicy = {
  type: 'content_filter' | 'tool_restriction' | 'approval_required';
  enabled: boolean;
  rulesJson: Record<string, unknown>;
};

type SeedAgent = {
  name: string;
  systemPrompt: string;
  model: string;
  channels: string[];
  toolPermissions: Record<string, unknown>;
  status: string;
};

type SeedUser = {
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  authProvider: string;
};

type SeedData = {
  policies: SeedPolicy[];
  agents: SeedAgent[];
  users: SeedUser[];
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

export async function runSeed(seedFilePath?: string) {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const defaultSeedPath = resolve(currentDir, '../../../../seed/lfg-policies.json');
  const raw = await readFile(seedFilePath ?? defaultSeedPath, 'utf8');
  const seedData = JSON.parse(raw) as SeedData;

  for (const user of seedData.users) {
    await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: user.name,
          role: user.role,
          authProvider: user.authProvider,
          updatedAt: new Date(),
        },
      });
  }

  for (const agent of seedData.agents) {
    const [existingAgent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.name, agent.name))
      .limit(1);

    if (!existingAgent) {
      await db.insert(agents).values(agent);
      continue;
    }

    await db
      .update(agents)
      .set({
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        channels: agent.channels,
        toolPermissions: agent.toolPermissions,
        status: agent.status,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, existingAgent.id));
  }

  for (const policy of seedData.policies) {
    const existingPolicies = await db
      .select({
        enabled: policies.enabled,
        rulesJson: policies.rulesJson,
      })
      .from(policies)
      .where(eq(policies.type, policy.type));

    const nextRules = stableStringify(policy.rulesJson);
    const alreadyExists = existingPolicies.some((existing) => {
      if (existing.enabled !== policy.enabled) {
        return false;
      }
      return stableStringify(existing.rulesJson) === nextRules;
    });

    if (alreadyExists) {
      continue;
    }

    await db.insert(policies).values({
      type: policy.type,
      enabled: policy.enabled,
      rulesJson: policy.rulesJson,
    });
  }

  return {
    users: seedData.users.length,
    agents: seedData.agents.length,
    policies: seedData.policies.length,
  };
}
