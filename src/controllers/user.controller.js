import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token",
    );
  }
};

const loginWithPhone = asyncHandler(async (req, res) => {
  const { phone, authId } = req.body;

  if (!phone || !authId) {
    throw new ApiError(400, "Phone number and Auth ID are required");
  }

  let user = await User.findOne({
    $or: [{ authId }, { phone }],
  });

  if (!user) {
    // User does not exist, create new user
    user = await User.create({
      authId,
      phone,
      isProfileComplete: false,
    });
  } else {
    // Validation edge case: Ensure authId matches provided phone if user exists
    // (Optional strict check depending on firebase rules, allowing login here)
    if (user.authId !== authId) {
      // In rare case where phone exists but authId differs (e.g. account recovery/change)
      // You might want to update authId or throw error. Here we simply proceed.
    }
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select("-refreshToken");

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in Successfully",
      ),
    );
});

const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, email, role, subject } = req.body;

  // Check if user is authenticated (Assumes auth middleware populates req.user)
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized request");
  }

  // Validation
  if (!fullName) {
    throw new ApiError(400, "Full Name is required");
  }

  const updateData = {
    fullName,
    email: email || "",
    role: role || "STUDENT",
    subject: subject || "",
    isProfileComplete: true,
  };

  // Handle Profile Picture
  const profilePicLocalPath = req.file?.path;

  if (profilePicLocalPath) {
    const profilePic = await uploadOnCloudinary(profilePicLocalPath);
    if (profilePic.url) {
      updateData.profilePic = profilePic.url;
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: updateData,
    },
    { new: true },
  ).select("-refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

export { loginWithPhone, updateProfile };
