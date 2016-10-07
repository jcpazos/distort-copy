TODO:

CHANGE THE RECIPIENT SELECTION TOOL:
Currently, the recipient selection tool is just a selectbox with a list of users, which presumably Twistor would have to provide. This is cumbersome for the user, if there's hundreds or thousands of users. A better solution would be to have a text input element and have the write the names of the recipients.


USE IMAGE STEGANOGRAPHY:
Encode messages in an image instead of plain ct or utf encoding.
There are two reasons for this:
 -The whole message, key and tag, don't fit into one tweet, so we need to post two tweets for every message.
 -The posted message looks like spam, which Twitter might not like.


Popular images would be preferred, e.g. pictures of current events (Rio 2016),
puppies, kitties, etc. Upload these images to Twitter.



EXPLORE HASHTAG MODEL:
Check possible issues with the hashtag mode: Does the streaming API actually grant completeness for track parameters? This is the only known possible
issue, needs further testing. Additionally, explore how to distribute messages eg. using multiple hashtags to separate the twistor space into several anonimity groups),
mainly due to processing constraints (can everyone's phone/computer process 500,000+ messages an hour?). 
Idea: Twistor could check for this, overlay shows how many people in each hashtag, people make decisions on which one to use based on this.


ADD TWISTOR VERIFICATION FUNCTIONALITY FOR PUBLIC KEYS:
It might not be possible to stop Twitter from targeting a single specific user and spoofing everything this user does. Instead, we can use Twistor to help us set up a protocol for public key verification. Roughly speaking: Alice posts her public key, Bob is streaming for public keys and gets it but isn't sure if Twitter intercepted the message and changed the public key. Bob asks Twistor to setup a communication channel with Alice to check with Alice herself if the information is correct. If Twistor and Twitter are colluding, this is still dangerous.


CHANGE TWISTOR: 
Twistor needs a complete makeover since most of its functionality is now done in beeswax or in the app: Keeping a database of users, adding verification as mentioned above.



ADDITIONS TO BEESWAX:

STREAMING FROM CLIENT SIDE:
Instead of streaming from twistor for each user, we can have each user set up their own stream from the extension and they can take care of processing each of the tweets. This also prevents twistor from getting read-access to the user's account. We need to maintain two streams, one for encrypted message tweets (TweetStreamer) and one for public key tweets (PKeyStreamer). These are both currently implemented but due to the sheer amount of tweets each stream might be getting in the future, performance has to be monitored. Of course, these will slightly change once steganography is implemented.
A StreamerManager was added to deal with the Streamers, as an user could have several tabs streaming, and we need to keep track of this in order to clean up the connections. A few additions to Cryptoctx were done for this purpose as well.



ENCRYPTION OF GENERAL MESSAGES WITH ELGAMAL:

We need to be able to encrypt any message (written to a hidden container) or number of messages for multiple recipients with elGamal, this is what lighten_multiple and encryptMessage provide. This is currently implemented and working well. 

Due to the limit on the number of characters we can fit into a tweet, we would like to have the ciphertext occupy as little space as possible. Currently, we three steps that together give us a considerable amount of space: 

-Instead of passing both coordinates of a point on the curve, we just pass the x-coordinate and one number representing the  positive (1) or negative (0) root, and calculate the y-coordinate when we need it, i.e. we only need 1 byte for y instead of 48 bytes. Of course, this takes a bit of extra time to do. We also take advantage of UTF encoding to mash the characters together. Because of the UTF encoding, the root needs to be translated to base64 along with the ciphertext, so on average this takes an extra 2 bytes instead of 1. 
It should be noted that without UTF encoding it's basically impossible to send messages through twitter, as even the smallest messages do not fit into the tweet limitation.

-The last thing we do is to post a tweet and reply to it with another one, one with the tag of the ciphertext and the other one with the key, essentially putting two tweets into one (although this wastes more POST requests, Twitter might also not like automated replies). Again, these all would probably be unnecessary with steganography.


ELGAMAL DECRYPTION:

Once we receive a message we need to decrypt it and put it into a hidden container. darken_elGamal provides this functionality. A note on decrypting that briefly came up in a discussion: SJCL seems to somehow know whether you are using the right key for decryption, but this should not be the case. This needs exploring.


POSTING GENERAL MESSAGES TO TWITTER:

In a similar manner to how public keys are posted to Twitter from Beeswax, we also need to be able to post the encrypted messages, and so an addition was made to post any text. 



ANONKEY AND ANONSTREAM:

In order to maintain a binding between recipients of a message and the message itself, we need a stream that holds a key which has the information about both. This is what anonkey
and anonstream do. Once recipients are selected, this information is saved into the anonkey, so that once the message is ready to be sent, no alterations were done to the recipients
other than the ones the user chooses to do. Some changes were made update_priv_ind to take into account this additional functionality.

