//requires and initialazations
var express = require('express');
var app = express();
var DButilsAzure = require('./DButils');
var util = require('util');
var bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const secret = 'secret';
app.use(bodyParser.json()); // support json encoded bodies
//app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

//table constants
const user_column_names = ['User_name','First_name','Last_name','City','Country', 'Password', 'Email', 'favPOI1', 'favPOI2', 'token'];
const userInterest_column_names = ['User_name', 'Category_name'];
const review_column_names = ['reviewID','content','Date','rating','POI_ID','User_name'];
const userFavorites_column_names = ['User_name', 'POI_ID', 'POI_name'];
var port = 3000;
app.listen(port, function () {
    console.log('Example app listening on port ' + port);
});

function surround_with_quotes(string_to_surround){
    return util.format("\'%s\'",string_to_surround)
}

async function create_token(username){
    let payload = {id: 1, name: username, admin: false};
    let options = {expiresIn: "365d"};
    const token = jwt.sign(payload, secret, options);
    return token;
}

let delete_query = (tableName, where_conditions_array) => {
    return new Promise((resolve, reject) => {
        var where_condition = where_conditions_array.join(' AND ');
        var query = util.format("DELETE FROM %s\n" +
            "WHERE %s",tableName,where_condition);
        console.log("ATTEMPTING TO EXECUTE QUERY:\n"+query);
        DButilsAzure.execQuery(query)
            .then(function (res) {
                resolve(res)
            })
            .catch(function (err) {
                reject(err)
            })
    })
};

function get_insert_query(table_name, cols_names_array, cols_values_array){
    var column_names = cols_names_array.join(', ');
    var column_values = cols_values_array.join(', ');
    var query = util.format('INSERT INTO %s (%s)\n' +
        'VALUES (%s)',
        table_name,column_names,column_values);
    return query;
}

let select_query = (table_name,cols_to_select_array, where_conditions_array) => {
    return new Promise(
        ((resolve, reject) =>{
            var cols = ((typeof cols_to_select_array === 'string' || cols_to_select_array instanceof String) && cols_to_select_array == '*')//check if string and equal to "*"
                ?'*':cols_to_select_array.join(', ');
            var query = util.format('SELECT %s\n' +
                'FROM %s'
                ,cols, table_name);
            if(where_conditions_array && where_conditions_array.length>0){
                query+="\nWHERE "+where_conditions_array.join(" AND ");
            }
            console.log(util.format('Attempting to perform select query:\n%s',query));
            DButilsAzure.execQuery(query)
                .then(function (res) {
                    resolve(res)
                })
                .catch(function (err) {
                    reject(err)
                })
        })
    );
};

let update_query = (table_name,columnToUpdate, where_conditions_array, newValue) => {
    return new Promise(
        ((resolve, reject) =>{
            var query = util.format('UPDATE %s ' +
                'SET %s' +' = %s '
                ,table_name, columnToUpdate,newValue);
            if(where_conditions_array && where_conditions_array.length>0){
                query+=" WHERE "+where_conditions_array.join(" AND ");
            }
            console.log(util.format('Attempting to perform select query:\n%s',query));
            DButilsAzure.execQuery(query)
                .then(function (res) {
                    resolve(res)
                })
                .catch(function (err) {
                    reject(err)
                })
        })
    );
};

function validateToken(token){
    // const token = req.header("x-auth-token");
    // no token
    if (!token) res.status(401).send("Access denied. No token provided.");
    return false;
    // verify token
    try {

        const decoded = jwt.verify(token, secret);
        req.decoded = decoded;


    } catch (exception) {
        res.status(400).send("Invalid token.");
        return false;
    }
    return true;
}


app.get('/get_categories', function(req, res){
    select_query('Categories','*')
        .then(function (result) {
            var categories = [];
            for (let i = 0; i < result.length; i++) {
                categories.push(result[i]['Category_name']);
            }
            var json_to_send = {categories:categories};
            res.json(json_to_send);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
});
app.get ('/get_poi_details', function(req, res){
    var poi_id = req.body['poi_id'];
    try {

        var where_conditions = [util.format("poi_id=%s",poi_id)];

        select_query('POI','*',where_conditions)
            .then(function (poi_result) {
                var reviews_table_name = 'reviews';
                var reviews_rows = ['content','date'];
                var reviews_where_condition = [util.format('POI_ID=%s',poi_id)];
                select_query(reviews_table_name,reviews_rows,reviews_where_condition)
                    .then(function (reviews_result) {
                        var reviews = [];
                        if(reviews_result) {
                            for (let i = 0; i < reviews_result.length; i++) {
                                reviews.push({
                                    content: reviews_result[i]['content'],
                                    date: reviews_result[i]['date']
                                })
                            }
                        }
                        var json_to_send = {
                            name:poi_result[0]['name'],
                            viewsAmount:poi_result[0]['view_amount'],
                            description:poi_result[0]['description'],
                            category:poi_result[0]['Category_name'],
                            reviews:reviews
                        };
                        res.json(json_to_send)
                    })
                    .catch(function (error) {
                        res.send(error);
                    })
            })
            .catch(function (result) {
                res.send(result);
            })
    }
    catch (e) {
        res.send(e);
    }
});

/*app.get ('/get_poi_details', function(req, res){
    var poi_id = req.body['poi_id'];
    try {
        var viewsAmount = req.body['viewsAmount'];
        var description = req.body['description'];
        var reviews_range = req.body['reviews range'];
        var table_name = 'POI';
        var rows_to_select = ['name','description','Category_name','view_amount'];
        var where_conditions = [util.format("poi_id=%s",poi_id)];
        if(viewsAmount){
            where_conditions.push(util.format("(view_amount BETWEEN %s AND %s)",viewsAmount['min'].toString(),viewsAmount['max'].toString()));
        }
        //get needed results from poi table
        select_query(table_name,rows_to_select,where_conditions)
            .then(function (poi_result) {
                var reviews_table_name = 'reviews';
                var reviews_rows = ['content','date'];
                var reviews_where_condition = [util.format('POI_ID=%s',poi_id)];
                if(reviews_range){
                    reviews_where_condition.push(util.format("rating BETWEEN %s AND %s",reviews_range['min'],reviews_range['max']));
                }
                //get needed results from reviews table
                select_query(reviews_table_name,reviews_rows,reviews_where_condition)
                    .then(function (reviews_result) {
                        var reviews = [];
                        //if there are any reviews, then get them
                        if(reviews_result) {
                            for (let i = 0; i < reviews_result.length; i++) {
                                reviews.push({
                                    content: reviews_result[i]['content'],
                                    date: reviews_result[i]['date']
                                })
                            }
                        }
                        //send results
                        var json_to_send = {
                            viewsAmount:poi_result[0]['view_amount'],
                            description:poi_result[0]['description'],
                            category:poi_result[0]['Category_name'],
                            reviews:reviews
                        };
                        res.json(json_to_send)
                    })
                    .catch(function (error) {
                        res.send(error);
                    })
            })
            .catch(function (result) {
                res.send(result);
            })
    }
    catch (e) {
        res.send(e);
    }
});


 */
app.get('/get_retrieval_questions_for_user',function (req, res) {
    var username = req.body['username'];
    select_query('retrievalQuestions',['Question'],[util.format('User_name=\'%s\'',username)])
        .then(function (result) {
            var questions = [];
            for (let i = 0; i < result.length; i++) {
                var question = result[i]['Question'];
                questions.push(question);
            }
            var json_to_send = {
                questions:questions
            };
            res.json(json_to_send);
        })
});


app.get('/reviews', function (req, res) {
    select_query('reviews','*')
        .then(function (result) {
            res.send(result);
        })
        .catch(function (error) {
            res.send(error);
        })
    /*var json_params = req.param('json');
    console.log('params: '+json_params);
    var json = JSON.parse(json_params);
    console.log(util.format('id: ',json['id']));*/
});

app.post('/login',function (req,res) {
    var username = req.body['username'];
    var password = req.body['password'] ;
    select_query('USERS',['User_name'],[util.format("User_name='%s'",username),util.format("Password=\'%s\'",password)])
        .then(async function (result) {
            if (result && result.length > 0) {
                const token = await create_token(username);
                //todo insert token to users table first time login
                //todo res.send({ result: "Hello user + username" });

                res.send(token);

            } else {
                res.status(404).send('Incorrect username and password');
            }
        })
        .catch(function (error) {
            res.send(error);
        })
});

app.post('/register',function (req,res) {
    var firstname=req.body['firstname'], lastname=req.body['lastname'], city=req.body['lastname'],
        country=req.body['country'], email=req.body['email'], username=req.body['username'],
        password=req.body['password'], favorite_categories=req.body['interests'];
    var user_values = [surround_with_quotes(username),surround_with_quotes(firstname),surround_with_quotes(lastname),surround_with_quotes(city),surround_with_quotes(country),surround_with_quotes(password),surround_with_quotes(email)];
    //check all paramaters recieved
    if(!(favorite_categories && favorite_categories.length>0 && firstname && lastname && city
        && country && email && username && password && favorite_categories)){
        res.status(400).send('missing parameters')
    }
    else {
        var insert_userInterest_queries = [];
        for (let i = 0; i < favorite_categories.length; i++) {
            insert_userInterest_queries.push(get_insert_query('userInterests',userInterest_column_names,[surround_with_quotes(username),surround_with_quotes(favorite_categories[i])]));
        }
        var insert_userInterest_transaction_query = util.format("BEGIN TRANSACTION;\n" +
            "%s;\n" +
            "COMMIT TRANSACTION;",insert_userInterest_queries.join(';\n'));
        var inset_user_query = get_insert_query('users', user_column_names, user_values);

        console.log(util.format("ATTEMPTING TO EXECUTE QUERY:\n%s",inset_user_query));
        DButilsAzure.execQuery(inset_user_query)
            .then(function (result1) {
                console.log(util.format("ATTEMPTING TO EXECUTE QUERY:\n%s",insert_userInterest_transaction_query));
                DButilsAzure.execQuery(insert_userInterest_transaction_query)
                    .then(function (result2) {
                        res.status(200).send('registration completed successfully');
                    })
                    .catch(function (err1) {
                        var delete_where_conditions=[];
                        for (let i = 0; i < user_column_names.length; i++) {
                            delete_where_conditions.push(util.format('%s=%s',user_column_names[i],(user_values[i])));
                        }
                        delete_query('users',delete_where_conditions)
                            .then(function (result3) {
                                res.send(err1 + '\nNo registration completed')
                            })
                            .catch(function (err2) {
                                res.send(util.format('First error:\n%s\nSecond Error:%s\nUSER CREATED, NO CATEGORIES INSERTED, USER NOT DELETED',err1,err2))
                            })
                    })
            })
            .catch(function (err) {
                res.send(err);
            })
    }
});

app.post('/validate_usernames_answers',function (req,res) {
    var username = req.body['username'];
    var question_and_answers = req.body['questions_answers'];
    var answers_are_valid=true;
    for (let i = 0; i < question_and_answers.length && answers_are_valid; i++) {
        var where_conditions=[];
        where_conditions.push(util.format('User_name=\'%s\'',username));
        where_conditions.push(util.format('Question=\'%s\'',question_and_answers[i]['question']));
        where_conditions.push(util.format('Answer=\'%s\''));
        select_query('retrievalQuestions','*',where_conditions)
            .then(function (result) {
                if(!(result && result.length>0))
                    answers_are_valid=false;
            })
            .catch(function (err) {
                res.status(500).send(err);
            })
    }
    if(answers_are_valid){
        select_query('users',['Password'],[util.format("User_name=\'%s\'",username)])
            .then(function (result) {
                var password = result[0]['Password'];
                var json_to_send = {password:password};
                res.json(json_to_send);
            })
            .catch(function (err) {
                res.status(500).send(err);
            })
    }
    else {
        res.status(400).send("UNABLE TO VALIDATE QUESTIONS")
    }
});

app.get('/get_user_details',function (req,res) {
    var username = req.body['username'];
    select_query('users','*',[util.format("User_name=\'%s\'",username)])
        .then(function (result) {
            var json_to_send = {
                firstname:result[0]['First_name'],
                lastname:result[0]['Last_name'],
                city:result[0]['City'],
                country:result[0]['Country'],
                email:result[0]['Email'],
                username:username,
                password:result[0]['Password']
            };
            res.json(json_to_send);
        })
        .catch(function (err) {
            res.send(err);
        })
});

let sort_pois_by_avg_rating = () => {
    return new Promise((resolve, reject) => {
            var sorted_pois = [];
            var get_sorted_poi_query = 'SELECT POI_ID\n' +
                'From reviews\n' +
                'Group by POI_ID\n' +
                'Order by -AVG(cast(rating as decimal))';
            DButilsAzure.execQuery(get_sorted_poi_query)
                .then(function (result) {
                    for (let i = 0; i < result.length; i++) {
                        sorted_pois.push(result[i]['POI_ID']);
                    }
                    resolve(sorted_pois)
                })
                .catch(function (err) {
                    reject(err);
                })
        }
    )
};

app.get('/get_POIs',function (req,res) {
    var categories = req.body['categories'];
    var sorted_by_rating = (req.body['sorted_by_rating'] && (typeof req.body['sorted_by_rating'] === 'string' || req.body['sorted_by_rating'] instanceof String) && req.body['sorted_by_rating'].toLowerCase() === 'true');
    var rating_range = req.body["rating range"];

    var where_conditions = [];
    var sorted_pois = [];


    if(categories){
        var categories_surrounded_by_quotes = [];
        for (let i = 0; i < categories.length; i++) {
            categories_surrounded_by_quotes.push(surround_with_quotes(categories[i]))
        }
        where_conditions.push(util.format("Category_name in (%s)",categories_surrounded_by_quotes.join(', ')));
    }
    if(rating_range){
        where_conditions.push(util.format("(POI_ID IN (SELECT POI_ID FROM (SELECT POI_ID, AVG(cast(rating as decimal)) as avg FROM reviews GROUP BY POI_ID) WHERE avg BETWEEN %s AND %s)", rating_range['minimal_rating'],rating_range['maximal_rating']));
    }

    select_query('POI', ['POI_ID'],where_conditions)
        .then(function (desired_pois_as_tuple) {
            var desired_pois = [];
            for (let i = 0; i < desired_pois_as_tuple.length; i++) {
                desired_pois.push(desired_pois_as_tuple[i]['POI_ID']);
            }
            var poi_ids = [];
            console.log("sorted by rating: " + sorted_by_rating);
            if (sorted_by_rating){
                sort_pois_by_avg_rating()
                    .then(function (sorted_pois) {
                        for (let i = 0; i < sorted_pois.length; i++) {
                            if([sorted_pois[i] in desired_pois])
                                poi_ids.push(sorted_pois[i])
                        }
                        for (let i = 0; i < desired_pois[i]; i++) {
                            if(!(desired_pois[i]) in poi_ids){
                                poi_ids.push(desired_pois[i]);
                            }
                        }
                        var json_to_return = {poi_ids:poi_ids};
                        res.json(json_to_return)
                    })
                    .catch(function (err) {
                        res.status(500).send(err)
                    })
            }
            else {
                poi_ids = desired_pois;
                console.log('length: '+poi_ids.length);
                var json_to_return = {poi_ids:poi_ids};
                res.json(json_to_return)
            }
        })
        .catch(function (err) {
            res.status(500).send(err)
        })
});

app.get('/POI', function (req, res) {
    select_query('POI','*')
        .then(function (result) {
            res.send(result);
        })
        .catch(function (error) {
            res.send(error);
        })
});

app.get('/retrievalQuestions', function (req, res) {
    select_query('retrievalQuestions','*')
        .then(function (result) {
            res.send(result);
        })
        .catch(function (error) {
            res.send(error);
        })
});

app.get('/userInterests', function (req, res) {
    select_query('userInterests','*')
        .then(function (result) {
            res.send(result);
        })
        .catch(function (error) {
            res.send(error);
        })
});

app.get('/users', function (req, res) {
    select_query('users','*')
        .then(function (result) {
            res.send(result);
        })
        .catch(function (error) {
            res.send(error);
        })
});

app.post('/test',function (req, res) {
    console.log(req.body);      // your JSON
    res.send(req.body);    // echo the result back
});

//todo



app.get('/get_poi_ids_by_name', function(req, res){
    var POI_NAME = req.body['POI_NAME'];//todo name?
    select_query('POI',['POI_ID'],[util.format('name=\'%s\'',POI_NAME)])
        .then(function (result) {
            var pois = [];
            for (let i = 0; i < result.length; i++) {
                pois.push(result[i]['POI_ID']);
            }
            var json_to_send = {pois:pois};
            res.json(json_to_send);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
});

// app.get('/get_2_last_reviews', function(req, res){
//     var POI_NAME = req.body['POI_ID'];
//     select_query('reviews',['content','Date'],[util.format('name=\'%s\'',POI_NAME)])
//         .then(function (result) {
//             var pois = [];
//             for (let i = 0; i < result.length; i++) {
//                 pois.push(result[i]['POI_ID']);
//             }
//             var json_to_send = {pois:pois};
//             res.json(json_to_send);
//         })
//         .catch(function (err) {
//             console.log(err);
//             res.send(err);
//         })
// SELECT * FROM (
//     SELECT
// ROW_NUMBER() OVER (ORDER BY Date Desc) AS rownumber,
//     content,Date
// FROM reviews
// ) AS foo
// WHERE rownumber <= 2
// });

app.get('/get_random_popular_pois', function(req, res){
    select_query('reviews','*',[util.format("rating>'%s'",3)])
        .then(function (result) {
            var pois = [];
            for (let i = 0; i < result.length; i++) {
                pois.push(result[i]['POI_ID']);
            }
            var pois3 = []
            let count = 0;
            while(pois.length>0 && count<3){
                var x;
                x=Math.floor(Math.random()*pois.length);
                var item = pois[x];
                pois3.push(item);
                count++;
            }


            var json_to_send = {pois:pois3};
            res.json(json_to_send);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
});

// todo try catch in case no 2 fav pois existz
app.get('/getfavorites',function (req, res) {
    //todo token, not username
    var username = req.body['username'];
    select_query('users','*',[util.format('User_name=\'%s\'',username)])
        .then(function (result) {
            var favPOIs = [];
            favPOIs.push(result[0]['favPOI1']);
            favPOIs.push(result[0]['favPOI2']);
            var json_to_send = {favorites:favPOIs};
            res.json(json_to_send);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
});

app.put('/setfavorites',function (req, res) {
    //todo token, not username
    //todo var token = req.header['token'];
    var username = req.body['username'];
    var newFavoritePOI = req.body['poi_id'];
    var moveFavPOI = '10';
    //todo if(validateToken(token) == true) {

    select_query('users','*',[util.format('User_name=\'%s\'',username)])
        .then(async function (result) {
            moveFavPOI = await result[0]['favPOI2'];
            moveFavPOI=moveFavPOI.toString();
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
    update_query('users', 'favPOI2', [util.format('User_name=\'%s\'', username)],newFavoritePOI)
        .then(function (result) {


        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
    update_query('users', 'favPOI1', [util.format('User_name=\'%s\'', username)],moveFavPOI)
        .then(function (result) {


            var favPOIs = [];
            favPOIs.push(moveFavPOI);
            favPOIs.push(newFavoritePOI);
            var json_to_send = {favorites: favPOIs};
            res.json(json_to_send);


        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })

    // }
});

app.get('/get_country', function(req, res){
    select_query('country','*')
        .then(function (result) {
            var countries = [];
            for (let i = 0; i < result.length; i++) {
                countries.push(result[i]['country_name']);
            }
            var json_to_send = {countries:countries};
            res.json(json_to_send);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
});

app.post('/add_review_to_POI',function (req,res) {


});
app.get('/get_POIIDs_ByCategory',function (req,res) {
    var categoryName = req.body['category'];
    select_query('POI','*',[util.format('Category_name=\'%s\'', categoryName)])
        .then(function (result) {
            var pois = [];
            for (let i = 0; i < result.length; i++) {
                pois.push(result[i]['POI_ID']);
            }
            var json_to_send = {categoryPOIs:pois};
            res.json(json_to_send);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
});

app.post('/add_review_to_POI',function (req,res) {
    var reviewID=req.body['reviewID'], content=req.body['content'],
        Date=req.body['Date'], rating=req.body['rating'], poi_id=req.body['poi_id'], username=req.body['username'];
    var review_values = [surround_with_quotes(reviewID),surround_with_quotes(content),surround_with_quotes(Date),surround_with_quotes(rating),surround_with_quotes(poi_id),surround_with_quotes(username)];
    //check all paramaters recieved
    if(!(reviewID && content && date && rating && poiId && userName  )){
        res.status(400).send('missing parameters')
    }
    else {
        var insert_review_query = get_insert_query('reviews', review_column_names,review_values);
        console.log(util.format("ATTEMPTING TO EXECUTE QUERY:\n%s", insert_review_query));
        DButilsAzure.execQuery(insert_review_query)
            .then(function (result) {
                res.status(200).send('review added successfully');
            })
            .catch(function (err) {
                res.send(err);
            })
    }
});

app.get('/get_Validation_questions', function(req, res){
    select_query('ValidationQuestions','*')
        .then(function (result) {
            var questions = [];
            for (let i = 0; i < result.length; i++) {
                questions.push(result[i]['que_description']);
            }
            var json_to_send = {questions:questions};
            res.json(json_to_send);
        })
        .catch(function (err) {
            console.log(err);
            res.send(err);
        })
});

app.get('/get_POI_Picture',function (req,res) {
    var poi_name = req.body['poi_name'];
    select_query('POI','Picture',[util.format('name=\'%s\'', poi_name)])
        .then(function (result) {
            res.send(result);
        })
        .catch(function (error) {
            res.send(error);
        })
});

app.post('/save_user_favorites',function (req,res) {
    var username=req.body['username'], poi_id=req.body['poi_id'], poi_name=req.body['poi_name'];
    var save_values = [surround_with_quotes(username),surround_with_quotes(poi_id),surround_with_quotes(poi_name)];
    //check all paramaters recieved
    if(!(username && poi_id && poi_name)){
        res.status(400).send('missing parameters')
    }
    else {
        var inset_user_query = get_insert_query('userFavorites', userFavorites_column_names, save_values);
        console.log(util.format("ATTEMPTING TO EXECUTE QUERY:\n%s",inset_user_query));
        DButilsAzure.execQuery(inset_user_query)
            .then(function (result1) {
                        res.status(200).send('saving favorites completed successfully');
                    })
                    .catch(function (err1) {
                        var delete_where_conditions=[];
                        for (let i = 0; i < user_column_names.length; i++) {
                            delete_where_conditions.push(util.format('%s=%s',userFavorites_column_names[i],(save_values[i])));
                        }
                        delete_query('users',delete_where_conditions)
                            .then(function (result2) {
                                res.send(err1 + '\nsaving is not completed')
                            })
                            .catch(function (err2) {
                                res.send(util.format('First error:\n%s\nSecond Error:%s\nFavorite CREATED, Favorite is NOT DELETED',err1,err2))
                            })
                    })
            .catch(function (err) {
                res.send(err);
            })
    }
});

app.get('/get_FavoritePOIs',function (req,res) {
    var categories = req.body['categories'];
    var sorted_by_rating = (req.body['sorted_by_rating'] && (typeof req.body['sorted_by_rating'] === 'string' || req.body['sorted_by_rating'] instanceof String) && req.body['sorted_by_rating'].toLowerCase() === 'true');
    var rating_range = req.body["rating range"];
    var where_conditions = [];
    if(categories){
        var categories_surrounded_by_quotes = [];
        for (let i = 0; i < categories.length; i++) {
            categories_surrounded_by_quotes.push(surround_with_quotes(categories[i]))
        }
        where_conditions.push(util.format("Category_name in (%s)",categories_surrounded_by_quotes.join(', ')));
    }
    if(rating_range){
        where_conditions.push(util.format("(POI_ID IN (SELECT POI_ID FROM (SELECT POI_ID, AVG(cast(rating as decimal)) as avg FROM reviews GROUP BY POI_ID) WHERE avg BETWEEN %s AND %s)", rating_range['minimal_rating'],rating_range['maximal_rating']));
    }
    select_query('userFavorites', ['POI_ID'],where_conditions)
        .then(function (desired_pois_as_tuple) {
            var desired_pois = [];
            for (let i = 0; i < desired_pois_as_tuple.length; i++) {
                desired_pois.push(desired_pois_as_tuple[i]['POI_ID']);
            }
            var poi_ids = [];
            console.log("sorted by rating: " + sorted_by_rating);
            if (sorted_by_rating){
                sort_pois_by_avg_rating()
                    .then(function (sorted_pois) {
                        for (let i = 0; i < sorted_pois.length; i++) {
                            if([sorted_pois[i] in desired_pois])
                                poi_ids.push(sorted_pois[i])
                        }
                        for (let i = 0; i < desired_pois[i]; i++) {
                            if(!(desired_pois[i]) in poi_ids){
                                poi_ids.push(desired_pois[i]);
                            }
                        }
                        var json_to_return = {poi_ids:poi_ids};
                        res.json(json_to_return)
                    })
                    .catch(function (err) {
                        res.status(500).send(err)
                    })
            }
            else {
                poi_ids = desired_pois;
                console.log('length: '+poi_ids.length);
                var json_to_return = {poi_ids:poi_ids};
                res.json(json_to_return)
            }
        })
        .catch(function (err) {
            res.status(500).send(err)
        })
});

