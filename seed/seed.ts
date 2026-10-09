import { runSeed } from '../packages/api/src/seed/run-seed.ts';

async function main() {
  const result = await runSeed();

  // eslint-disable-next-line no-console
  console.log(
    `Seed completed: ${result.users} users, ${result.agents} agents, ${result.policies} policies.`,
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    process.exit(1);
  });
