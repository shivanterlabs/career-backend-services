const BASE_URL = "https://ykq0pkeh54.execute-api.eu-west-1.amazonaws.com/dev";

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Request failed");
  return data;
};

export const adminApi = {
  login: (email, password) =>
    request("/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  getTests: () => request("/admin/tests"),
  createTest: (payload) =>
    request("/admin/tests", { method: "POST", body: JSON.stringify(payload) }),
  updateTest: (testId, payload) =>
    request(`/admin/tests/${testId}`, { method: "PUT", body: JSON.stringify(payload) }),

  getQuestions: (testId) => request(`/admin/questions?testId=${testId}`),
  createQuestion: (payload) =>
    request("/admin/questions", { method: "POST", body: JSON.stringify(payload) }),
  updateQuestion: (questionId, payload) =>
    request(`/admin/questions/${questionId}`, { method: "PUT", body: JSON.stringify(payload) }),
};
