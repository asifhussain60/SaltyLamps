// Routing tests isolate host/authentication behaviour from resource identity.
export const productionBindings = {
  DEPLOYMENT_ENV: 'production',
  DB: { prepare: () => ({ first: async () => null }) },
  IMAGES: { get: async () => null },
}
