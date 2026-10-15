import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      AWS_REGION: "us-east-1",
      S3_BUCKET: "test-bucket",
      AWS_ACCESS_KEY_ID: "test-access-key",
      AWS_SECRET_ACCESS_KEY: "test-secret-key",
      S3_KMS_KEY_ALIAS: "alias/test-key",
    },
  },
});
