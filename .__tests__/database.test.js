const database = require("../database.js");

test("Fake test", () => {
  const result = database.fakeTest(1);
  expect(result).toBe(2);
})
