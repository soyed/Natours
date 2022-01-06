class APIFeatures {
  /**
   *
   * @param {Tour |  User } query => this is based on the mongoose model built
   * @param {type: Request.query} queryString => contains the request query params that needs to be extracted
   */
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    // 1) EXCLUDING FIELDS
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((field) => delete queryObj[field]);

    // 2) ADVANCED FILTERING => to use gte?|lte? => simply pass the property[filter]=value
    let queryStr = JSON.stringify(queryObj);
    queryStr = JSON.parse(
      queryStr.replace(/\b(gte?|lte?)\b/g, (match) => `$${match}`)
    );

    this.query = this.query.find(queryStr);
    // return the entire object to support nesting witht other features
    return this;
  }

  // sort() => is a mongoose method of filtering results based on properties selected
  // sorting with a second criteria
  //  this fallback address cases where the property values match
  sort() {
    if (this.queryString.sort) {
      const sortCriteria = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortCriteria);
    } else {
      // sort by createdAt field => new ones first
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  //3) Sorting
  //4) FIELDS => fields=name,price,duration
  limitFields() {
    if (this.queryString.fields) {
      // this process is called projecting
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  // PAGINATION => FETCHING according to page number
  // using page and limit
  // pagination on mongoose use => skip and limit
  // page=2&limit=10 => this means if there are 100 tours => skip 1 -10 and return 11 - 20 and so on that is the mean idea
  paginate() {
    const page = Number(this.queryString.page) || 1;
    const limit = Number(this.queryString.limit) || 100;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    // check that page number is valid
    // if (this.queryString.page) {
    //   const numTours = await this.query.countDocuments();
    //   if (skip >= numTours) {
    //     throw new Error('This page does not exist');
    //   }
    // }

    return this;
  }
}

module.exports = APIFeatures;
