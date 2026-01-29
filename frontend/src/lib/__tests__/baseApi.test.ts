/**
 * Base API Utilities Tests
 */

import {
  get,
  post,
  put,
  del,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  addRequestInterceptor,
  addResponseInterceptor,
  addErrorInterceptor,
  isApiError,
  isAuthError,
  isNetworkError,
  isTimeoutError,
  createCancelToken,
} from '../api/baseApi';

// ===========================================
// Setup
// ===========================================

const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  mockFetch.mockClear();
  clearAuthToken();
  localStorage.getItem.mockClear();
  localStorage.setItem.mockClear();
  localStorage.removeItem.mockClear();
});

// ===========================================
// Token Management Tests
// ===========================================

describe('Token Management', () => {
  it('should set and get auth token', () => {
    setAuthToken('test-token');
    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'test-token');

    (localStorage.getItem as jest.Mock).mockReturnValue('test-token');
    expect(getAuthToken()).toBe('test-token');
  });

  it('should clear auth token', () => {
    setAuthToken('test-token');
    clearAuthToken();
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
  });
});

// ===========================================
// HTTP Methods Tests
// ===========================================

describe('HTTP Methods', () => {
  const mockResponse = (data: any, status = 200) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    } as Response);
  };

  describe('GET', () => {
    it('should make a GET request', async () => {
      mockFetch.mockReturnValue(mockResponse({ data: 'test' }));

      const result = await get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should include query params', async () => {
      mockFetch.mockReturnValue(mockResponse({ data: 'test' }));

      await get('/test', { params: { foo: 'bar', num: 123 } });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/test?foo=bar&num=123',
        expect.anything()
      );
    });

    it('should include auth token in headers', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('my-token');
      mockFetch.mockReturnValue(mockResponse({ data: 'test' }));

      await get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });
  });

  describe('POST', () => {
    it('should make a POST request with body', async () => {
      mockFetch.mockReturnValue(mockResponse({ id: 1 }));

      const result = await post('/users', { name: 'John' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'John' }),
        })
      );
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('PUT', () => {
    it('should make a PUT request', async () => {
      mockFetch.mockReturnValue(mockResponse({ updated: true }));

      await put('/users/1', { name: 'Jane' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Jane' }),
        })
      );
    });
  });

  describe('DELETE', () => {
    it('should make a DELETE request', async () => {
      mockFetch.mockReturnValue(mockResponse({ deleted: true }));

      await del('/users/1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/users/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});

// ===========================================
// Error Handling Tests
// ===========================================

describe('Error Handling', () => {
  it('should throw ApiError for non-ok responses', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'Not found' }),
      })
    );

    await expect(get('/not-found')).rejects.toMatchObject({
      status: 404,
      message: 'Not found',
    });
  });

  it('should handle 401 errors', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'Unauthorized' }),
      })
    );

    try {
      await get('/protected');
    } catch (error) {
      expect(isAuthError(error)).toBe(true);
    }
  });
});

// ===========================================
// Interceptor Tests
// ===========================================

describe('Interceptors', () => {
  it('should call request interceptors', async () => {
    const interceptor = jest.fn((config) => ({
      ...config,
      headers: { ...config.headers, 'X-Custom': 'test' },
    }));

    const unsubscribe = addRequestInterceptor(interceptor);

    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      })
    );

    await get('/test');

    expect(interceptor).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom': 'test',
        }),
      })
    );

    unsubscribe();
  });

  it('should call error interceptors on failure', async () => {
    const errorInterceptor = jest.fn();
    const unsubscribe = addErrorInterceptor(errorInterceptor);

    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'Server error' }),
      })
    );

    try {
      await get('/error');
    } catch {
      // Expected
    }

    expect(errorInterceptor).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        message: 'Server error',
      })
    );

    unsubscribe();
  });
});

// ===========================================
// Utility Function Tests
// ===========================================

describe('Utility Functions', () => {
  describe('isApiError', () => {
    it('should return true for API errors', () => {
      expect(isApiError({ status: 404, message: 'Not found' })).toBe(true);
    });

    it('should return false for non-API errors', () => {
      expect(isApiError(new Error('test'))).toBe(false);
      expect(isApiError('string')).toBe(false);
      expect(isApiError(null)).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for 401 errors', () => {
      expect(isAuthError({ status: 401, message: 'Unauthorized' })).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isAuthError({ status: 403, message: 'Forbidden' })).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      expect(isNetworkError({ status: 0, message: 'Network error', code: 'NETWORK_ERROR' })).toBe(true);
    });
  });

  describe('isTimeoutError', () => {
    it('should return true for timeout errors', () => {
      expect(isTimeoutError({ status: 0, message: 'Timeout', code: 'TIMEOUT' })).toBe(true);
    });
  });

  describe('createCancelToken', () => {
    it('should create a cancel token', () => {
      const { signal, cancel } = createCancelToken();

      expect(signal).toBeInstanceOf(AbortSignal);
      expect(typeof cancel).toBe('function');
    });
  });
});
