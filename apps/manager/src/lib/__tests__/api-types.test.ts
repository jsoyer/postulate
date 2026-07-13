import { describe, it, expect } from "vitest"
import { ApiError } from "@/lib/api-types"

describe("ApiError", () => {
  describe("construction with 404", () => {
    const err = new ApiError(404, { code: 404, message: "Not found" })

    it("sets statusCode", () => {
      expect(err.statusCode).toBe(404)
    })

    it("sets message from body", () => {
      expect(err.message).toBe("Not found")
    })

    it("sets name to ApiError", () => {
      expect(err.name).toBe("ApiError")
    })

    it("exposes the full body", () => {
      expect(err.body.code).toBe(404)
      expect(err.body.message).toBe("Not found")
    })
  })

  describe("construction with 500", () => {
    const err = new ApiError(500, { code: 500, message: "Server error" })

    it("is an instance of Error", () => {
      expect(err).toBeInstanceOf(Error)
    })

    it("is an instance of ApiError", () => {
      expect(err).toBeInstanceOf(ApiError)
    })

    it("sets statusCode to 500", () => {
      expect(err.statusCode).toBe(500)
    })
  })

  it("instanceof check distinguishes ApiError from plain Error", () => {
    const apiErr = new ApiError(422, { code: 422, message: "Unprocessable" })
    const plainErr = new Error("plain")

    expect(apiErr instanceof ApiError).toBe(true)
    expect(plainErr instanceof ApiError).toBe(false)
  })

  it("can be caught as a generic Error", () => {
    const fn = () => {
      throw new ApiError(401, { code: 401, message: "Unauthorized" })
    }

    expect(fn).toThrow(Error)
    expect(fn).toThrow("Unauthorized")
  })
})
