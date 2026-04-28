module.exports = {
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => null),
  resetGenericPassword: jest.fn(async () => true),
};

