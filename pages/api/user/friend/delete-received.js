import { mongoose } from 'mongoose'
import { authenticate } from "../../../../utils/authenticate"
import { checkUserType } from '../../../../utils/checkUserType'
import connectDB from '../../../../utils/connectDB'
import User from '../../../../models/userModel'

/**
 * @desc    Delete received friend request
 * @route   POST /api/user/friend/delete-received
 * @access  Private - Students
 * @param   {string} req.body.friendId - Account id of person you want delete the friend request of
 */
export default async function (req, res) {
  try {
    if(req.method !== 'POST') {
      throw new Error(`${req.method} is an invalid request method`)
    }

    // Connect to database
    await connectDB()

    // Authenticate and get user
    const user = await authenticate(req.headers.authorization)

    // Make sure user is a student
    checkUserType(user, 1)

    const { friendId } = req.body

    const friendIdObj = new mongoose.Types.ObjectId(friendId)

    if(!user.receivedFriendRequests.includes(friendIdObj)) {
      throw new Error('You did not send a friend request of that id')
    }

    const friend = await User.findById(friendIdObj)
    if(!friend) {
      throw new Error('Cannot find user of that id')
    }

    // Delete friend request
    user.receivedFriendRequests = user.friends.filter((element) => element == friendIdObj)
    friend.sentFriendRequests = friend.friends.filter((element) => element == user._id)

    // Update database
    await User.findByIdAndUpdate(user._id, {
      receivedFriendRequests: user.receivedFriendRequests,
    })
    await User.findByIdAndUpdate(friendIdObj, {
      sentFriendRequests: friend.sentFriendRequests,
    })

    // Instead of sending ids, send objects for friends and friend requests
    const receivedFriendRequests = await User.find({ _id: { $in: user.receivedFriendRequests} }, { password: 0})
    const sentFriendRequests = await User.find({ _id: { $in: user.sentFriendRequests} }, { password: 0})
    const friends = await User.find({ _id: { $in: user.friends} }, { password: 0})

    res.status(200).json({
      user,
      receivedFriendRequests,
      sentFriendRequests,
      friends
    })

  } catch(error) {
    res.status(400).json({message: error.message})
  }
}
