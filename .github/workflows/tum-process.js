const fs = require("node:fs");

/**
 * @typedef TopicConfig
 * @type { { name: { [key: string]: string }, security: boolean, caution?: { [key: string]: string }, topics?: string[], packages?: { [key: string]: string | boolean | null } } }
 */

/**
 * Translates a TOML topic configuration into a structured JSON object.
 * @param {import("toml")} toml
 * @param {import("@cfworker/json-schema").Validator} schemaValidator
 * @param {string} content
 * @returns
 */
function translateTopic(toml, schemaValidator, content) {
  /**
   * @type { TopicConfig }
   */
  const topic = toml.parse(content);

  if (schemaValidator.validate(topic).valid) {
    console.log("Valid TOML");
  } else {
    console.error("Invalid TOML:", schemaValidator.validate(topic).errors);
    throw new Error("Invalid TOML");
  }
  // rewrite package versions
  if (topic.packages) {
    Object.keys(topic.packages).forEach((pkg) => {
      if (!topic.packages[pkg]) {
        topic.packages[pkg] = null;
      }
    });
  }

  topic.type = topic.packages ? "conventional" : "cumulative";
  return topic;
}

/**
 *
 * @param {(name: string) => import(name)} require
 * @param {string | null} topic
 * @param {string} outputPath
 */
export function generateTopicUpdateData(require, topic, outputPath) {
  const toml = require("toml");
  const validator = require("@cfworker/json-schema");
  const schema = require("../../topics/tum.schema.json");
  const schemaValidator = new validator.Validator(schema);

  /**
   * @type { { [key: string]: { type: "conventional" | "cumulative", name: { [key: string]: string }, security: boolean, caution?: { [key: string]: string }, topics?: string[], packages?: { [key: string]: string | null } } } }
   */
  let result = {};
  if (!topic) {
    console.error("No topic specified. Use 'stable' or a topic name.");
    return;
  }
  if (topic === "stable") {
    fs.readdirSync("topics").forEach((file) => {
      if (!file.endsWith(".toml")) {
        return;
      }
      const filePath = `topics/${file}`;
      const content = fs.readFileSync(filePath, "utf-8");

      const topicName = file.replace(/\.toml$/, "");
      result[topicName] = translateTopic(toml, schemaValidator, content);
    });
  } else {
    result[topic] = translateTopic(
      toml,
      schemaValidator,
      fs.readFileSync(`topics/${topic}.toml`, "utf-8")
    );
  }

  const outputDirPath = `${outputPath}/${topic}`;
  fs.mkdirSync(outputDirPath, { recursive: true });
  fs.writeFileSync(`${outputDirPath}/updates.json`, JSON.stringify(result));
}
